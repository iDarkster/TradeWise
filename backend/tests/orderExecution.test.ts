import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "../src/generated/prisma/client.js";
import { prisma } from "../src/lib/prisma.js";
import { executeOrder } from "../src/services/orderExecution.service.js";
import { createPortfolio } from "../src/services/portfolio.service.js";

let userId: string;
let portfolioId: string;
let instrumentId: string;

async function createOrder(
  side: "BUY" | "SELL",
  quantity: number,
  type: "MARKET" | "LIMIT" = "MARKET",
  limitPrice?: string,
) {
  return prisma.order.create({
    data: {
      portfolioId,
      instrumentId,
      side,
      type,
      productType: "DELIVERY",
      quantity,
      ...(limitPrice ? { limitPrice: new Prisma.Decimal(limitPrice) } : {}),
    },
  });
}

async function clearLedgerForTest(portfolioIdToClear: string) {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "PortfolioLedgerEntry" DISABLE TRIGGER USER',
  );
  try {
    await prisma.portfolioLedgerEntry.deleteMany({
      where: { portfolioId: portfolioIdToClear },
    });
  } finally {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "PortfolioLedgerEntry" ENABLE TRIGGER USER',
    );
  }
}

async function resetPortfolio(cash = "100000.00") {
  await clearLedgerForTest(portfolioId);
  await prisma.trade.deleteMany({
    where: { order: { portfolioId } },
  });
  await prisma.order.deleteMany({ where: { portfolioId } });
  await prisma.holding.deleteMany({ where: { portfolioId } });
  await prisma.portfolio.update({
    where: { id: portfolioId },
    data: { cashBalance: new Prisma.Decimal(cash) },
  });
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `execution-test-${crypto.randomUUID()}@tradewise.test`,
      passwordHash: "test-only-not-a-real-password",
    },
  });
  userId = user.id;

  const portfolio = await prisma.portfolio.create({
    data: {
      userId,
      name: "Execution Integration Test",
      initialBalance: new Prisma.Decimal("100000.00"),
      cashBalance: new Prisma.Decimal("100000.00"),
    },
  });
  portfolioId = portfolio.id;

  const instrument = await prisma.instrument.create({
    data: { symbol: "TWTST", exchange: "TEST" },
  });
  instrumentId = instrument.id;
});

beforeEach(async () => {
  await resetPortfolio();
});

afterAll(async () => {
  if (portfolioId) {
    await clearLedgerForTest(portfolioId);
    await prisma.trade.deleteMany({ where: { order: { portfolioId } } });
    await prisma.order.deleteMany({ where: { portfolioId } });
    await prisma.holding.deleteMany({ where: { portfolioId } });
    await prisma.portfolio.delete({ where: { id: portfolioId } });
  }
  if (instrumentId) {
    await prisma.instrument.delete({ where: { id: instrumentId } });
  }
  if (userId) {
    await prisma.user.delete({ where: { id: userId } });
  }
  await prisma.$disconnect();
});

describe("order execution integration", () => {
  it("executes BUY and updates cash, holding, trade and ledger", async () => {
    const order = await createOrder("BUY", 10);
    const result = await executeOrder(order.id, "100.0000");

    expect(result.status).toBe("EXECUTED");
    const portfolio = await prisma.portfolio.findUniqueOrThrow({
      where: { id: portfolioId },
    });
    const holding = await prisma.holding.findUniqueOrThrow({
      where: { portfolioId_instrumentId: { portfolioId, instrumentId } },
    });
    const ledger = await prisma.portfolioLedgerEntry.findMany({ where: { portfolioId } });

    expect(portfolio.cashBalance.toString()).toBe("99000");
    expect(holding.quantity).toBe(10);
    expect(holding.averageBuyPrice.toString()).toBe("100");
    expect(ledger).toHaveLength(1);
    expect(ledger[0]!.amount.toString()).toBe("-1000");
  });

  it("calculates weighted-average price after a second BUY", async () => {
    await executeOrder((await createOrder("BUY", 10)).id, "100");
    await executeOrder((await createOrder("BUY", 10)).id, "120");

    const holding = await prisma.holding.findUniqueOrThrow({
      where: { portfolioId_instrumentId: { portfolioId, instrumentId } },
    });

    expect(holding.quantity).toBe(20);
    expect(holding.averageBuyPrice.toString()).toBe("110");
  });

  it("executes SELL and calculates realized profit", async () => {
    await executeOrder((await createOrder("BUY", 10)).id, "100");
    const sell = await createOrder("SELL", 10);
    const result = await executeOrder(sell.id, "120");

    expect(result.status).toBe("EXECUTED");
    if (result.status !== "EXECUTED") throw new Error("Expected execution");

    expect(result.trade.costBasisAmount?.toString()).toBe("1000");
    expect(result.trade.realizedPnl?.toString()).toBe("200");

    const portfolio = await prisma.portfolio.findUniqueOrThrow({
      where: { id: portfolioId },
    });
    expect(portfolio.cashBalance.toString()).toBe("100200");
    expect(await prisma.holding.count({ where: { portfolioId } })).toBe(0);
  });

  it("allows partial liquidation and preserves average cost", async () => {
    await executeOrder((await createOrder("BUY", 10)).id, "100");
    await executeOrder((await createOrder("SELL", 4)).id, "120");

    const holding = await prisma.holding.findUniqueOrThrow({
      where: { portfolioId_instrumentId: { portfolioId, instrumentId } },
    });

    expect(holding.quantity).toBe(6);
    expect(holding.averageBuyPrice.toString()).toBe("100");
  });

  it("rejects SELL beyond available holdings", async () => {
    const order = await createOrder("SELL", 1);
    const result = await executeOrder(order.id, "100");

    expect(result.status).toBe("REJECTED");
    expect(await prisma.trade.count({ where: { orderId: order.id } })).toBe(0);
  });

  it("rejects BUY when cash is insufficient", async () => {
    await resetPortfolio("500");
    const order = await createOrder("BUY", 10);
    const result = await executeOrder(order.id, "100");

    expect(result.status).toBe("REJECTED");
    const portfolio = await prisma.portfolio.findUniqueOrThrow({
      where: { id: portfolioId },
    });
    expect(portfolio.cashBalance.toString()).toBe("500");
    expect(await prisma.trade.count({ where: { orderId: order.id } })).toBe(0);
  });

  it("does not execute an order twice", async () => {
    const order = await createOrder("BUY", 10);
    const first = await executeOrder(order.id, "100");
    const retry = await executeOrder(order.id, "999");

    expect(first.status).toBe("EXECUTED");
    expect(retry.status).toBe("EXECUTED");
    if (retry.status !== "EXECUTED") throw new Error("Expected execution");
    expect(retry.alreadyExecuted).toBe(true);
    expect(await prisma.trade.count({ where: { orderId: order.id } })).toBe(1);
    expect(await prisma.portfolioLedgerEntry.count({ where: { portfolioId } })).toBe(1);
  });

  it("leaves a non-marketable LIMIT order pending", async () => {
    const order = await createOrder("BUY", 1, "LIMIT", "100");
    const result = await executeOrder(order.id, "101");

    expect(result.status).toBe("PENDING");
    const stored = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(stored.status).toBe("PENDING");
    expect(await prisma.trade.count({ where: { orderId: order.id } })).toBe(0);
  });

  it("executes a LIMIT order when its price condition is met", async () => {
    const order = await createOrder("BUY", 1, "LIMIT", "100");
    const result = await executeOrder(order.id, "99");

    expect(result.status).toBe("EXECUTED");
  });
});


describe("portfolio creation and ledger integrity", () => {
  it("creates a portfolio with matching initial funding ledger entry", async () => {
    const portfolio = await createPortfolio(
      userId,
      "Portfolio Creation Test",
      "25000.00",
    );

    try {
      const entries = await prisma.portfolioLedgerEntry.findMany({
        where: { portfolioId: portfolio.id },
      });

      expect(portfolio.initialBalance.toFixed(2)).toBe("25000.00");
      expect(portfolio.cashBalance.toFixed(2)).toBe("25000.00");
      expect(entries).toHaveLength(1);
      expect(entries[0]!.entryType).toBe("INITIAL_FUNDING");
      expect(entries[0]!.amount.toFixed(2)).toBe("25000.00");
      expect(entries[0]!.balanceAfter.toFixed(2)).toBe("25000.00");
      expect(entries[0]!.tradeId).toBeNull();
    } finally {
      await clearLedgerForTest(portfolio.id);
      await prisma.portfolio.delete({ where: { id: portfolio.id } });
    }
  });

  it("rolls back portfolio creation if initial ledger insertion fails", async () => {
    const triggerName = "test_fail_ledger_insert";
    const functionName = "test_fail_ledger_insert_fn";

    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION ${functionName}()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Simulated ledger insertion failure';
      END;
      $$ LANGUAGE plpgsql;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER ${triggerName}
      BEFORE INSERT ON "PortfolioLedgerEntry"
      FOR EACH ROW EXECUTE FUNCTION ${functionName}();
    `);

    try {
      const before = await prisma.portfolio.count({ where: { userId } });

      await expect(
        createPortfolio(userId, "Should Roll Back", "10000.00"),
      ).rejects.toThrow();

      const after = await prisma.portfolio.count({ where: { userId } });
      expect(after).toBe(before);
    } finally {
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS ${triggerName} ON "PortfolioLedgerEntry"`,
      );
      await prisma.$executeRawUnsafe(
        `DROP FUNCTION IF EXISTS ${functionName}()`,
      );
    }
  });

  it("rejects updates to existing ledger entries", async () => {
    const entry = await prisma.portfolioLedgerEntry.create({
      data: {
        portfolioId,
        entryType: "TEST_IMMUTABILITY",
        amount: new Prisma.Decimal("100.00"),
        balanceAfter: new Prisma.Decimal("100100.00"),
      },
    });

    await expect(
      prisma.portfolioLedgerEntry.update({
        where: { id: entry.id },
        data: { amount: new Prisma.Decimal("999.00") },
      }),
    ).rejects.toThrow(/immutable/i);

    await clearLedgerForTest(portfolioId);
  });

  it("rejects deletion of ledger entries", async () => {
    const entry = await prisma.portfolioLedgerEntry.create({
      data: {
        portfolioId,
        entryType: "TEST_IMMUTABILITY",
        amount: new Prisma.Decimal("100.00"),
        balanceAfter: new Prisma.Decimal("100100.00"),
      },
    });

    await expect(
      prisma.portfolioLedgerEntry.delete({
        where: { id: entry.id },
      }),
    ).rejects.toThrow(/immutable/i);

    await clearLedgerForTest(portfolioId);
  });

  it("rejects portfolio creation for inactive users", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    try {
      await expect(
        createPortfolio(userId, "Inactive User Portfolio", "10000.00"),
      ).rejects.toThrow(/not eligible/i);
    } finally {
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: true },
      });
    }
  });

  it("rejects zero or negative initial funding", async () => {
    await expect(
      createPortfolio(userId, "Invalid Portfolio", "0"),
    ).rejects.toThrow(/positive amount/i);

    await expect(
      createPortfolio(userId, "Invalid Portfolio", "-100"),
    ).rejects.toThrow(/positive amount/i);
  });
});

describe("concurrent order execution", () => {
  it("prevents concurrent BUY orders from overspending", async () => {
    await resetPortfolio("1000.00");

    const firstOrder = await createOrder("BUY", 10);
    const secondOrder = await createOrder("BUY", 10);

    const results = await Promise.all([
      executeOrder(firstOrder.id, "100"),
      executeOrder(secondOrder.id, "100"),
    ]);

    expect(results.filter((r) => r.status === "EXECUTED")).toHaveLength(1);
    expect(results.filter((r) => r.status === "REJECTED")).toHaveLength(1);

    const portfolio = await prisma.portfolio.findUniqueOrThrow({
      where: { id: portfolioId },
    });

    expect(portfolio.cashBalance.toFixed(2)).toBe("0.00");
    expect(await prisma.trade.count({ where: { order: { portfolioId } } })).toBe(1);
  });

  it("prevents concurrent SELL orders from overselling", async () => {
    await executeOrder((await createOrder("BUY", 10)).id, "100");

    const firstOrder = await createOrder("SELL", 10);
    const secondOrder = await createOrder("SELL", 10);

    const results = await Promise.all([
      executeOrder(firstOrder.id, "120"),
      executeOrder(secondOrder.id, "120"),
    ]);

    expect(results.filter((r) => r.status === "EXECUTED")).toHaveLength(1);
    expect(results.filter((r) => r.status === "REJECTED")).toHaveLength(1);

    expect(await prisma.holding.count({ where: { portfolioId } })).toBe(0);
    expect(await prisma.trade.count({ where: { order: { portfolioId } } })).toBe(2);
  });
});

describe("account access restrictions", () => {
  it("rejects portfolio creation for soft-deleted users", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });

    try {
      await expect(
        createPortfolio(userId, "Deleted User Portfolio", "10000.00"),
      ).rejects.toThrow(/not eligible/i);
    } finally {
      await prisma.user.update({
        where: { id: userId },
        data: { deletedAt: null },
      });
    }
  });

  it("rejects order execution for soft-deleted users", async () => {
    const order = await createOrder("BUY", 1);

    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });

    try {
      const result = await executeOrder(order.id, "100");
      expect(result.status).toBe("REJECTED");

      const stored = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      expect(stored.status).toBe("REJECTED");
      expect(await prisma.trade.count({ where: { orderId: order.id } })).toBe(0);
    } finally {
      await prisma.user.update({
        where: { id: userId },
        data: { deletedAt: null },
      });
    }
  });
});

describe("database constraints and foreign keys", () => {
  it("rejects zero and negative order quantities", async () => {
    for (const quantity of [0, -1]) {
      await expect(
        prisma.order.create({
          data: {
            portfolioId,
            instrumentId,
            side: "BUY",
            type: "MARKET",
            productType: "DELIVERY",
            quantity,
          },
        }),
      ).rejects.toThrow();
    }
  });

  it("rejects invalid LIMIT price combinations", async () => {
    await expect(
      prisma.order.create({
        data: {
          portfolioId,
          instrumentId,
          side: "BUY",
          type: "LIMIT",
          productType: "DELIVERY",
          quantity: 1,
          limitPrice: null,
        },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.order.create({
        data: {
          portfolioId,
          instrumentId,
          side: "BUY",
          type: "MARKET",
          productType: "DELIVERY",
          quantity: 1,
          limitPrice: new Prisma.Decimal("100"),
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects zero executed quantity in trades", async () => {
    const order = await createOrder("BUY", 1);

    await expect(
      prisma.trade.create({
        data: {
          orderId: order.id,
          executedQty: 0,
          executedPrice: new Prisma.Decimal("100"),
          totalValue: new Prisma.Decimal("100"),
          executedAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects invalid OHLC candle data", async () => {
    const scenario = await prisma.marketScenario.create({
      data: {
        name: "Constraint Test",
        description: "Temporary integration-test scenario",
        scenarioType: "TEST",
        difficulty: "BEGINNER",
        generationType: "SYSTEM_GENERATED",
      },
    });

    try {
      await expect(
        prisma.scenarioCandle.create({
          data: {
            scenarioId: scenario.id,
            sequenceIndex: 0,
            timestamp: new Date(),
            open: new Prisma.Decimal("100"),
            high: new Prisma.Decimal("90"),
            low: new Prisma.Decimal("95"),
            close: new Prisma.Decimal("98"),
            volume: BigInt(100),
          },
        }),
      ).rejects.toThrow();
    } finally {
      await prisma.marketScenario.delete({ where: { id: scenario.id } });
    }
  });

  it("prevents deleting a portfolio that has orders", async () => {
    await createOrder("BUY", 1);

    await expect(
      prisma.portfolio.delete({ where: { id: portfolioId } }),
    ).rejects.toThrow();
  });

  it("prevents deleting an instrument referenced by orders", async () => {
    await createOrder("BUY", 1);

    await expect(
      prisma.instrument.delete({ where: { id: instrumentId } }),
    ).rejects.toThrow();
  });
});

describe("financial rounding", () => {
  it("rounds BUY transaction value and cash balance using HALF_UP", async () => {
    const order = await createOrder("BUY", 3);

    const result = await executeOrder(order.id, "10.0050");

    expect(result.status).toBe("EXECUTED");
    if (result.status !== "EXECUTED") return;

    expect(result.trade.totalValue.toFixed(2)).toBe("30.02");

    const updatedPortfolio = await prisma.portfolio.findUniqueOrThrow({
      where: { id: portfolioId },
    });

    expect(updatedPortfolio.cashBalance.toFixed(2)).toBe("99969.98");

    const ledger = await prisma.portfolioLedgerEntry.findFirstOrThrow({
      where: { tradeId: result.trade.id },
    });

    expect(ledger.amount.toFixed(2)).toBe("-30.02");
    expect(ledger.balanceAfter.toFixed(2)).toBe("99969.98");
  });

  it("rounds weighted average buy price to four decimal places", async () => {
    const firstOrder = await createOrder("BUY", 1);
    await executeOrder(firstOrder.id, "10.0000");

    const secondOrder = await createOrder("BUY", 2);
    await executeOrder(secondOrder.id, "10.0050");

    const holding = await prisma.holding.findUniqueOrThrow({
      where: {
        portfolioId_instrumentId: {
          portfolioId,
          instrumentId,
        },
      },
    });

    // (1 × 10.0000 + 2 × 10.0050) / 3 = 10.003333...
    expect(holding.averageBuyPrice.toFixed(4)).toBe("10.0033");
  });

  it("rounds SELL proceeds, cost basis and realized P&L correctly", async () => {
    const buyOrder = await createOrder("BUY", 3);
    await executeOrder(buyOrder.id, "10.0050");

    const sellOrder = await createOrder("SELL", 3);
    const result = await executeOrder(sellOrder.id, "10.0150");

    expect(result.status).toBe("EXECUTED");
    if (result.status !== "EXECUTED") return;

    expect(result.trade.totalValue.toFixed(2)).toBe("30.05");
    expect(result.trade.costBasisAmount?.toFixed(4)).toBe("30.0150");
    expect(result.trade.realizedPnl?.toFixed(2)).toBe("0.03");

    const updatedPortfolio = await prisma.portfolio.findUniqueOrThrow({
      where: { id: portfolioId },
    });

    expect(updatedPortfolio.cashBalance.toFixed(2)).toBe("100000.03");
  });
});
