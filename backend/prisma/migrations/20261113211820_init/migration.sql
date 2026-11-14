-- CreateEnum
CREATE TYPE "QuizStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "LessonProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "ScenarioGenerationType" AS ENUM ('SYSTEM_GENERATED', 'ADMIN_CREATED');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('MARKET', 'LIMIT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'EXECUTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('DELIVERY', 'INTRADAY');

-- CreateEnum
CREATE TYPE "QuizAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'ABANDONED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "avatarUrl" TEXT,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" UUID NOT NULL,
    "lessonId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "passingScore" INTEGER NOT NULL,
    "status" "QuizStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "scenarioId" UUID,
    "questionText" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "points" INTEGER NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Option" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "optionText" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,

    CONSTRAINT "Option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "lessonId" UUID NOT NULL,
    "status" "LessonProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "completedAt" TIMESTAMPTZ(6),

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "status" "QuizAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "score" INTEGER,
    "passed" BOOLEAN,
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "submittedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAnswer" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "selectedOptionId" UUID NOT NULL,

    CONSTRAINT "UserAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketScenario" (
    "id" UUID NOT NULL,
    "createdById" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "scenarioType" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "generationType" "ScenarioGenerationType" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioCandle" (
    "id" UUID NOT NULL,
    "scenarioId" UUID NOT NULL,
    "sequenceIndex" INTEGER NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL,
    "open" DECIMAL(18,4) NOT NULL,
    "high" DECIMAL(18,4) NOT NULL,
    "low" DECIMAL(18,4) NOT NULL,
    "close" DECIMAL(18,4) NOT NULL,
    "volume" BIGINT NOT NULL,

    CONSTRAINT "ScenarioCandle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonScenario" (
    "lessonId" UUID NOT NULL,
    "scenarioId" UUID NOT NULL,
    "displayOrder" INTEGER,

    CONSTRAINT "LessonScenario_pkey" PRIMARY KEY ("lessonId","scenarioId")
);

-- CreateTable
CREATE TABLE "Instrument" (
    "id" UUID NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "providerInstrumentId" TEXT,

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" UUID NOT NULL,
    "watchlistId" UUID NOT NULL,
    "instrumentId" UUID NOT NULL,
    "addedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartConfiguration" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "instrumentId" UUID NOT NULL,
    "chartType" TEXT NOT NULL,
    "settings" JSONB NOT NULL,

    CONSTRAINT "ChartConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "initialBalance" DECIMAL(20,2) NOT NULL,
    "cashBalance" DECIMAL(20,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "portfolioId" UUID NOT NULL,
    "instrumentId" UUID NOT NULL,
    "side" "OrderSide" NOT NULL,
    "type" "OrderType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "productType" "ProductType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "limitPrice" DECIMAL(18,4),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "executedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "executedQty" INTEGER NOT NULL,
    "executedPrice" DECIMAL(18,4) NOT NULL,
    "totalValue" DECIMAL(20,2) NOT NULL,
    "executedAt" TIMESTAMPTZ(6) NOT NULL,
    "costBasisAmount" DECIMAL(20,4),
    "realizedPnl" DECIMAL(20,2),

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" UUID NOT NULL,
    "portfolioId" UUID NOT NULL,
    "instrumentId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "averageBuyPrice" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioLedgerEntry" (
    "id" UUID NOT NULL,
    "portfolioId" UUID NOT NULL,
    "tradeId" UUID,
    "entryType" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "balanceAfter" DECIMAL(20,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "xpReward" INTEGER NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "achievementId" UUID NOT NULL,
    "earnedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminActivityLog" (
    "id" UUID NOT NULL,
    "adminUserId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_username_key" ON "Profile"("username");

-- CreateIndex
CREATE INDEX "Module_createdById_idx" ON "Module"("createdById");

-- CreateIndex
CREATE INDEX "Module_updatedById_idx" ON "Module"("updatedById");

-- CreateIndex
CREATE INDEX "Lesson_moduleId_idx" ON "Lesson"("moduleId");

-- CreateIndex
CREATE INDEX "Lesson_createdById_idx" ON "Lesson"("createdById");

-- CreateIndex
CREATE INDEX "Lesson_updatedById_idx" ON "Lesson"("updatedById");

-- CreateIndex
CREATE INDEX "Quiz_lessonId_idx" ON "Quiz"("lessonId");

-- CreateIndex
CREATE INDEX "Quiz_createdById_idx" ON "Quiz"("createdById");

-- CreateIndex
CREATE INDEX "Quiz_updatedById_idx" ON "Quiz"("updatedById");

-- CreateIndex
CREATE INDEX "Question_quizId_idx" ON "Question"("quizId");

-- CreateIndex
CREATE INDEX "Question_scenarioId_idx" ON "Question"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_id_quizId_key" ON "Question"("id", "quizId");

-- CreateIndex
CREATE INDEX "Option_questionId_idx" ON "Option"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Option_id_questionId_key" ON "Option"("id", "questionId");

-- CreateIndex
CREATE INDEX "LessonProgress_lessonId_idx" ON "LessonProgress"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonProgress_userId_lessonId_key" ON "LessonProgress"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_quizId_createdAt_idx" ON "QuizAttempt"("userId", "quizId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "QuizAttempt_quizId_idx" ON "QuizAttempt"("quizId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttempt_id_quizId_key" ON "QuizAttempt"("id", "quizId");

-- CreateIndex
CREATE INDEX "UserAnswer_questionId_idx" ON "UserAnswer"("questionId");

-- CreateIndex
CREATE INDEX "UserAnswer_selectedOptionId_idx" ON "UserAnswer"("selectedOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAnswer_attemptId_questionId_key" ON "UserAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "MarketScenario_createdById_idx" ON "MarketScenario"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioCandle_scenarioId_sequenceIndex_key" ON "ScenarioCandle"("scenarioId", "sequenceIndex");

-- CreateIndex
CREATE INDEX "LessonScenario_scenarioId_idx" ON "LessonScenario"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_exchange_symbol_key" ON "Instrument"("exchange", "symbol");

-- CreateIndex
CREATE INDEX "Watchlist_userId_idx" ON "Watchlist"("userId");

-- CreateIndex
CREATE INDEX "WatchlistItem_instrumentId_idx" ON "WatchlistItem"("instrumentId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_watchlistId_instrumentId_key" ON "WatchlistItem"("watchlistId", "instrumentId");

-- CreateIndex
CREATE INDEX "ChartConfiguration_userId_idx" ON "ChartConfiguration"("userId");

-- CreateIndex
CREATE INDEX "ChartConfiguration_instrumentId_idx" ON "ChartConfiguration"("instrumentId");

-- CreateIndex
CREATE INDEX "Portfolio_userId_idx" ON "Portfolio"("userId");

-- CreateIndex
CREATE INDEX "Order_portfolioId_idx" ON "Order"("portfolioId");

-- CreateIndex
CREATE INDEX "Order_instrumentId_idx" ON "Order"("instrumentId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_orderId_key" ON "Trade"("orderId");

-- CreateIndex
CREATE INDEX "Holding_instrumentId_idx" ON "Holding"("instrumentId");

-- CreateIndex
CREATE UNIQUE INDEX "Holding_portfolioId_instrumentId_key" ON "Holding"("portfolioId", "instrumentId");

-- CreateIndex
CREATE INDEX "PortfolioLedgerEntry_portfolioId_createdAt_idx" ON "PortfolioLedgerEntry"("portfolioId", "createdAt");

-- CreateIndex
CREATE INDEX "PortfolioLedgerEntry_tradeId_idx" ON "PortfolioLedgerEntry"("tradeId");

-- CreateIndex
CREATE INDEX "UserAchievement_achievementId_idx" ON "UserAchievement"("achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "AdminActivityLog_adminUserId_createdAt_idx" ON "AdminActivityLog"("adminUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminActivityLog_entityType_entityId_idx" ON "AdminActivityLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "MarketScenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Option" ADD CONSTRAINT "Option_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAnswer" ADD CONSTRAINT "UserAnswer_attemptId_quizId_fkey" FOREIGN KEY ("attemptId", "quizId") REFERENCES "QuizAttempt"("id", "quizId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAnswer" ADD CONSTRAINT "UserAnswer_questionId_quizId_fkey" FOREIGN KEY ("questionId", "quizId") REFERENCES "Question"("id", "quizId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAnswer" ADD CONSTRAINT "UserAnswer_selectedOptionId_questionId_fkey" FOREIGN KEY ("selectedOptionId", "questionId") REFERENCES "Option"("id", "questionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketScenario" ADD CONSTRAINT "MarketScenario_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioCandle" ADD CONSTRAINT "ScenarioCandle_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "MarketScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonScenario" ADD CONSTRAINT "LessonScenario_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonScenario" ADD CONSTRAINT "LessonScenario_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "MarketScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "Watchlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartConfiguration" ADD CONSTRAINT "ChartConfiguration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartConfiguration" ADD CONSTRAINT "ChartConfiguration_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioLedgerEntry" ADD CONSTRAINT "PortfolioLedgerEntry_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioLedgerEntry" ADD CONSTRAINT "PortfolioLedgerEntry_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminActivityLog" ADD CONSTRAINT "AdminActivityLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
