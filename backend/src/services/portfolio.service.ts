import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

export async function createPortfolio(
  userId: string,
  name: string,
  initialBalance: string,
) {
  const balance = new Prisma.Decimal(initialBalance).toDecimalPlaces(
    2,
    Prisma.Decimal.ROUND_HALF_UP,
  );

  if (!balance.isFinite() || balance.lte(0)) {
    throw new Error("Initial balance must be a positive amount");
  }

  const portfolioName = name.trim();

  if (!portfolioName) {
    throw new Error("Portfolio name is required");
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { isActive: true, deletedAt: true },
    });

    if (!user || !user.isActive || user.deletedAt !== null) {
      throw new Error("User is not eligible to create a portfolio");
    }

    const portfolio = await tx.portfolio.create({
      data: {
        userId,
        name: portfolioName,
        initialBalance: balance,
        cashBalance: balance,
      },
    });

    await tx.portfolioLedgerEntry.create({
      data: {
        portfolioId: portfolio.id,
        entryType: "INITIAL_FUNDING",
        amount: balance,
        balanceAfter: balance,
      },
    });

    return portfolio;
  });
}
