-- DropIndex
DROP INDEX "Lesson_moduleId_idx";

-- DropIndex
DROP INDEX "Order_portfolioId_idx";

-- DropIndex
DROP INDEX "Quiz_lessonId_idx";

-- CreateIndex
CREATE INDEX "Lesson_moduleId_status_idx" ON "Lesson"("moduleId", "status");

-- CreateIndex
CREATE INDEX "Module_status_orderIndex_idx" ON "Module"("status", "orderIndex");

-- CreateIndex
CREATE INDEX "Order_portfolioId_status_createdAt_idx" ON "Order"("portfolioId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_portfolioId_instrumentId_createdAt_idx" ON "Order"("portfolioId", "instrumentId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Quiz_lessonId_status_idx" ON "Quiz"("lessonId", "status");
