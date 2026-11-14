import { Prisma, type Trade } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

type ExecutionResult =
  | {
      status: "EXECUTED";
      trade: Trade;
      alreadyExecuted: boolean;
    }
  | {
      status: "REJECTED";
      reason: string;
    }
  | {
      status: "CANCELLED";
      reason: string;
    }
  | {
      status: "PENDING";
      reason: string;
    };

const ROUNDING = Prisma.Decimal.ROUND_HALF_UP;

function money(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, ROUNDING);
}

function price(value: string): Prisma.Decimal {
  let parsed: Prisma.Decimal;

  try {
    parsed = new Prisma.Decimal(value);
  } catch {
    throw new Error("Execution price must be a valid decimal string.");
  }

  if (!parsed.isFinite() || !parsed.isPositive()) {
    throw new Error("Execution price must be a positive finite value.");
  }

  return parsed.toDecimalPlaces(4, ROUNDING);
}

async function rejectOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  reason: string,
): Promise<ExecutionResult> {
  await tx.order.update({
    where: { id: orderId },
    data: { status: "REJECTED" },
  });

  return { status: "REJECTED", reason };
}

/**
 * Executes an existing PENDING order.
 *
 * executionPrice must be supplied by the trusted market-data/execution layer
 * as a decimal string. Do not pass a JavaScript floating-point number.
 *
 * The portfolio row is locked for the duration of the transaction. This
 * serializes financial executions within one portfolio and prevents two
 * concurrent orders from spending/selling the same available resources.
 */
export async function executeOrder(
  orderId: string,
  executionPrice: string,
): Promise<ExecutionResult> {
  if (!orderId) {
    throw new Error("Order ID is required.");
  }

  return prisma.$transaction(async (tx) => {
    // Lock the order first. A retry for the same order waits here and then
    // observes the committed status/trade from the first execution.
    const lockedOrders = await tx.$queryRaw<Array<{ portfolioId: string }>>`
      SELECT "portfolioId"
      FROM "Order"
      WHERE "id" = ${orderId}::uuid
      FOR UPDATE
    `;

    if (lockedOrders.length === 0) {
      throw new Error("Order not found.");
    }

    const initialOrder = await tx.order.findUnique({
      where: { id: orderId },
      include: { portfolio: { include: { user: true } } },
    });

    if (!initialOrder) {
      throw new Error("Order not found.");
    }

    // Serialize all financial operations for this portfolio. This also
    // protects the no-existing-Holding case during concurrent BUY/SELL work.
    await tx.$queryRaw`
      SELECT "id"
      FROM "Portfolio"
      WHERE "id" = ${initialOrder.portfolioId}::uuid
      FOR UPDATE
    `;

    // Re-read after acquiring the portfolio lock.
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { portfolio: { include: { user: true } } },
    });

    if (!order) {
      throw new Error("Order not found.");
    }

    if (order.status === "EXECUTED") {
      const existingTrade = await tx.trade.findUnique({
        where: { orderId },
      });

      if (!existingTrade) {
        throw new Error(
          "Integrity error: executed order has no corresponding trade.",
        );
      }

      return {
        status: "EXECUTED",
        trade: existingTrade,
        alreadyExecuted: true,
      };
    }

    if (order.status === "REJECTED") {
      return { status: "REJECTED", reason: "Order was previously rejected." };
    }

    if (order.status === "CANCELLED") {
      return { status: "CANCELLED", reason: "Order was cancelled." };
    }

    if (order.status !== "PENDING") {
      throw new Error(`Unsupported order status: ${order.status}`);
    }

    // Parse the price only after the idempotency check. A retry of an
    // already-executed order returns its original trade without re-execution.
    const executedPrice = price(executionPrice);

    if (!order.portfolio.user.isActive || order.portfolio.user.deletedAt) {
      return rejectOrder(tx, orderId, "User account is inactive or deleted.");
    }

    if (order.quantity <= 0) {
      return rejectOrder(tx, orderId, "Order quantity must be positive.");
    }

    if (
      order.type === "LIMIT" &&
      order.limitPrice !== null &&
      ((order.side === "BUY" && executedPrice.greaterThan(order.limitPrice)) ||
        (order.side === "SELL" && executedPrice.lessThan(order.limitPrice)))
    ) {
      return {
        status: "PENDING",
        reason: "Limit price condition was not met; order remains pending.",
      };
    }

    const totalValue = money(
      executedPrice.mul(order.quantity),
    );

    if (!totalValue.isPositive()) {
      return rejectOrder(
        tx,
        orderId,
        "Order value is below the minimum INR accounting precision.",
      );
    }

    const cashBalance = new Prisma.Decimal(order.portfolio.cashBalance);
    let nextCashBalance: Prisma.Decimal;
    let costBasisAmount: Prisma.Decimal | null = null;
    let realizedPnl: Prisma.Decimal | null = null;

    const holding = await tx.holding.findUnique({
      where: {
        portfolioId_instrumentId: {
          portfolioId: order.portfolioId,
          instrumentId: order.instrumentId,
        },
      },
    });

    if (order.side === "BUY") {
      if (cashBalance.lessThan(totalValue)) {
        return rejectOrder(tx, orderId, "Insufficient portfolio cash.");
      }

      nextCashBalance = money(cashBalance.minus(totalValue));

      if (holding) {
        const oldQuantity = holding.quantity;
        const newQuantity = oldQuantity + order.quantity;

        const weightedCost = new Prisma.Decimal(holding.averageBuyPrice)
          .mul(oldQuantity)
          .plus(executedPrice.mul(order.quantity));

        const newAveragePrice = weightedCost
          .div(newQuantity)
          .toDecimalPlaces(4, ROUNDING);

        await tx.holding.update({
          where: { id: holding.id },
          data: {
            quantity: newQuantity,
            averageBuyPrice: newAveragePrice,
          },
        });
      } else {
        await tx.holding.create({
          data: {
            portfolioId: order.portfolioId,
            instrumentId: order.instrumentId,
            quantity: order.quantity,
            averageBuyPrice: executedPrice,
          },
        });
      }
    } else {
      if (!holding || holding.quantity < order.quantity) {
        return rejectOrder(
          tx,
          orderId,
          "Insufficient holdings. Short selling is not permitted.",
        );
      }

      nextCashBalance = money(cashBalance.plus(totalValue));

      costBasisAmount = new Prisma.Decimal(holding.averageBuyPrice)
        .mul(order.quantity)
        .toDecimalPlaces(4, ROUNDING);

      const roundedCostBasis = money(costBasisAmount);
      realizedPnl = money(totalValue.minus(roundedCostBasis));

      const remainingQuantity = holding.quantity - order.quantity;

      if (remainingQuantity === 0) {
        await tx.holding.delete({ where: { id: holding.id } });
      } else {
        // Weighted-average cost remains unchanged after a partial liquidation.
        await tx.holding.update({
          where: { id: holding.id },
          data: { quantity: remainingQuantity },
        });
      }
    }

    const now = new Date();

    const trade = await tx.trade.create({
      data: {
        orderId,
        executedQty: order.quantity,
        executedPrice,
        totalValue,
        executedAt: now,
        costBasisAmount,
        realizedPnl,
      },
    });

    await tx.portfolio.update({
      where: { id: order.portfolioId },
      data: { cashBalance: nextCashBalance },
    });

    // Ledger convention: BUY is negative; SELL is positive.
    const ledgerAmount =
      order.side === "BUY" ? totalValue.negated() : totalValue;

    await tx.portfolioLedgerEntry.create({
      data: {
        portfolioId: order.portfolioId,
        tradeId: trade.id,
        entryType: order.side,
        amount: ledgerAmount,
        balanceAfter: nextCashBalance,
      },
    });

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "EXECUTED",
        executedAt: now,
      },
    });

    return {
      status: "EXECUTED",
      trade,
      alreadyExecuted: false,
    };
  });
}
