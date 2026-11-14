-- Module 1 requires account creation and update timestamps:
--
--   * the administrator user list sorts newest-first by default and supports
--     `createdFrom` / `createdTo` filters,
--   * the administrator user details report created/updated timestamps and a
--     registration date.
--
-- The Module 0 `User` model has neither column, and the approved Module 1
-- foundation migration did not add them, so they are introduced here as an
-- additive change. Existing rows are backfilled from the earliest available
-- registration evidence (the USER_REGISTERED security audit event, then the
-- earliest session) and fall back to the time of this migration. No existing
-- row is deleted and no existing column is modified.
ALTER TABLE "User"
ADD COLUMN "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "User" AS u
SET "createdAt" = COALESCE(
      (
        SELECT MIN(sal."createdAt")
        FROM "SecurityAuditLog" sal
        WHERE sal."userId" = u."id"
          AND sal."eventType" = 'USER_REGISTERED'
      ),
      (
        SELECT MIN(s."createdAt")
        FROM "AuthSession" s
        WHERE s."userId" = u."id"
      ),
      u."createdAt"
    );

ALTER TABLE "User"
ADD COLUMN "updatedAt" TIMESTAMPTZ(6);

UPDATE "User" AS u
SET "updatedAt" = u."createdAt";

-- Prisma manages `updatedAt` on the client, so the column intentionally has
-- no database default.
ALTER TABLE "User"
ALTER COLUMN "updatedAt" SET NOT NULL;

-- Supports the default newest-first ordering and the creation-date range
-- filters of the administrator user list.
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");
