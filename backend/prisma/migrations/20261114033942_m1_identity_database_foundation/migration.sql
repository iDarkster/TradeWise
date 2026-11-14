-- CreateEnum
CREATE TYPE "AuthRateLimitIdentifierType" AS ENUM ('ACCOUNT', 'EMAIL', 'IP');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastActivityAt" TIMESTAMPTZ(6),
ADD COLUMN     "lastLoginAt" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenDigest" CHAR(64) NOT NULL,
    "csrfTokenDigest" CHAR(64) NOT NULL,
    "userAgent" VARCHAR(512),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthRateLimit" (
    "id" UUID NOT NULL,
    "scope" VARCHAR(64) NOT NULL,
    "identifierType" "AuthRateLimitIdentifierType" NOT NULL,
    "identifierHash" CHAR(64) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMPTZ(6) NOT NULL,
    "blockedUntil" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AuthRateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityAuditLog" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "sessionId" UUID,
    "eventType" VARCHAR(96) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenDigest_key" ON "AuthSession"("tokenDigest");

-- CreateIndex
CREATE INDEX "AuthSession_userId_lastActivityAt_idx" ON "AuthSession"("userId", "lastActivityAt" DESC);

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthRateLimit_expiresAt_idx" ON "AuthRateLimit"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthRateLimit_scope_identifierType_identifierHash_key" ON "AuthRateLimit"("scope", "identifierType", "identifierHash");

-- CreateIndex
CREATE INDEX "SecurityAuditLog_userId_createdAt_idx" ON "SecurityAuditLog"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SecurityAuditLog_sessionId_createdAt_idx" ON "SecurityAuditLog"("sessionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SecurityAuditLog_eventType_createdAt_idx" ON "SecurityAuditLog"("eventType", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAuditLog" ADD CONSTRAINT "SecurityAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAuditLog" ADD CONSTRAINT "SecurityAuditLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AuthSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Canonical identity storage and case-insensitive username uniqueness.
ALTER TABLE "User"
ADD CONSTRAINT "User_email_canonical_check"
CHECK ("email" = lower(btrim("email")));

ALTER TABLE "Profile"
ADD CONSTRAINT "Profile_username_trimmed_check"
CHECK ("username" = btrim("username"));

CREATE UNIQUE INDEX "Profile_username_case_insensitive_key"
ON "Profile" (lower("username"));

-- Sessions store only fixed-length SHA-256 digests and have a valid lifecycle.
ALTER TABLE "AuthSession"
ADD CONSTRAINT "AuthSession_token_digest_sha256_check"
CHECK ("tokenDigest" ~ '^[0-9a-f]{64}$'),
ADD CONSTRAINT "AuthSession_csrf_token_digest_sha256_check"
CHECK ("csrfTokenDigest" ~ '^[0-9a-f]{64}$'),
ADD CONSTRAINT "AuthSession_activity_after_creation_check"
CHECK ("lastActivityAt" >= "createdAt"),
ADD CONSTRAINT "AuthSession_expiry_after_activity_check"
CHECK ("expiresAt" > "lastActivityAt"),
ADD CONSTRAINT "AuthSession_revocation_after_creation_check"
CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt");

-- Rate-limit identities are HMAC SHA-256 digests; rate-limit rows may never
-- represent a negative count or an already-expired window.
ALTER TABLE "AuthRateLimit"
ADD CONSTRAINT "AuthRateLimit_identifier_hash_sha256_check"
CHECK ("identifierHash" ~ '^[0-9a-f]{64}$'),
ADD CONSTRAINT "AuthRateLimit_scope_nonempty_check"
CHECK (length(btrim("scope")) > 0),
ADD CONSTRAINT "AuthRateLimit_attempt_count_nonnegative_check"
CHECK ("attemptCount" >= 0),
ADD CONSTRAINT "AuthRateLimit_expiry_after_window_check"
CHECK ("expiresAt" > "windowStartedAt"),
ADD CONSTRAINT "AuthRateLimit_block_after_window_check"
CHECK ("blockedUntil" IS NULL OR "blockedUntil" >= "windowStartedAt");

-- Audit records are append-only. Preserve historical security records when
-- a User or AuthSession is detached through the SET NULL foreign keys above.
CREATE OR REPLACE FUNCTION prevent_admin_activity_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'Admin activity log entries are immutable.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_activity_log_no_update
BEFORE UPDATE ON "AdminActivityLog"
FOR EACH ROW
EXECUTE FUNCTION prevent_admin_activity_log_mutation();

CREATE TRIGGER admin_activity_log_no_delete
BEFORE DELETE ON "AdminActivityLog"
FOR EACH ROW
EXECUTE FUNCTION prevent_admin_activity_log_mutation();

CREATE OR REPLACE FUNCTION prevent_security_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'Security audit log entries are immutable.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER security_audit_log_no_update
BEFORE UPDATE ON "SecurityAuditLog"
FOR EACH ROW
EXECUTE FUNCTION prevent_security_audit_log_mutation();

CREATE TRIGGER security_audit_log_no_delete
BEFORE DELETE ON "SecurityAuditLog"
FOR EACH ROW
EXECUTE FUNCTION prevent_security_audit_log_mutation();
