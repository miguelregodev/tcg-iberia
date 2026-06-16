-- CreateEnum
CREATE TYPE "AbandonedCartStatus" AS ENUM ('ACTIVE', 'ABANDONED', 'RECOVERED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RecoveryEmailStatus" AS ENUM ('NONE', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "AbandonedCart" (
    "id" TEXT NOT NULL,
    "sessionKey" VARCHAR(255) NOT NULL,
    "userId" TEXT,
    "guestEmail" VARCHAR(255),
    "status" "AbandonedCartStatus" NOT NULL DEFAULT 'ACTIVE',
    "items" JSONB NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recoveryToken" VARCHAR(128),
    "recoveryTokenExpiresAt" TIMESTAMP(3),
    "recoveryEmailStatus" "RecoveryEmailStatus" NOT NULL DEFAULT 'NONE',
    "recoveryEmailSentAt" TIMESTAMP(3),
    "recoveredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "stripeSessionId" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbandonedCart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AbandonedCart_sessionKey_key" ON "AbandonedCart"("sessionKey");

-- CreateIndex
CREATE UNIQUE INDEX "AbandonedCart_recoveryToken_key" ON "AbandonedCart"("recoveryToken");

-- CreateIndex
CREATE INDEX "AbandonedCart_sessionKey_idx" ON "AbandonedCart"("sessionKey");

-- CreateIndex
CREATE INDEX "AbandonedCart_userId_idx" ON "AbandonedCart"("userId");

-- CreateIndex
CREATE INDEX "AbandonedCart_guestEmail_idx" ON "AbandonedCart"("guestEmail");

-- CreateIndex
CREATE INDEX "AbandonedCart_status_idx" ON "AbandonedCart"("status");

-- CreateIndex
CREATE INDEX "AbandonedCart_lastActivityAt_idx" ON "AbandonedCart"("lastActivityAt");

-- CreateIndex
CREATE INDEX "AbandonedCart_recoveryToken_idx" ON "AbandonedCart"("recoveryToken");

-- CreateIndex
CREATE INDEX "AbandonedCart_stripeSessionId_idx" ON "AbandonedCart"("stripeSessionId");

-- AddForeignKey
ALTER TABLE "AbandonedCart" ADD CONSTRAINT "AbandonedCart_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
