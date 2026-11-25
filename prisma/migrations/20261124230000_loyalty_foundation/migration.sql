-- CreateEnum
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('PURCHASE_REWARD', 'REDEMPTION', 'REFUND_REVERSAL', 'REDEMPTION_RESTORE', 'ADMIN_ADJUSTMENT', 'EXPIRATION', 'PROMOTIONAL_BONUS');

-- CreateEnum
CREATE TYPE "LoyaltyRedemptionStatus" AS ENUM ('RESERVED', 'SETTLED', 'RELEASED');

-- CreateTable
CREATE TABLE "LoyaltyProgramConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "baseRate" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "pointsPerEuro" DECIMAL(12,2) NOT NULL DEFAULT 100,
    "minimumRedemption" DECIMAL(12,2) NOT NULL DEFAULT 100,
    "redemptionIncrement" DECIMAL(12,2) NOT NULL DEFAULT 100,
    "maxDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "evaluationDays" INTEGER NOT NULL DEFAULT 60,
    "expirationMonths" INTEGER NOT NULL DEFAULT 12,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyProgramConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTier" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL DEFAULT 'default',
    "name" VARCHAR(100) NOT NULL,
    "position" INTEGER NOT NULL,
    "threshold" DECIMAL(12,2) NOT NULL,
    "multiplier" DECIMAL(10,4) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" VARCHAR(32) NOT NULL DEFAULT '#D4AF37',
    "icon" VARCHAR(100) NOT NULL DEFAULT '',
    "benefits" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "LoyaltyTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "orderId" TEXT,
    "actorId" TEXT,
    "type" "LoyaltyTransactionType" NOT NULL,
    "points" DECIMAL(16,2) NOT NULL,
    "balanceAfter" DECIMAL(16,2) NOT NULL,
    "description" TEXT NOT NULL,
    "idempotencyKey" VARCHAR(255) NOT NULL,
    "multiplier" DECIMAL(10,4),
    "eligibleSpend" DECIMAL(12,2),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyPointsLot" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "originalPoints" DECIMAL(16,2) NOT NULL,
    "remainingPoints" DECIMAL(16,2) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyPointsLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyOrderReward" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tierName" VARCHAR(100) NOT NULL,
    "multiplier" DECIMAL(10,4) NOT NULL,
    "baseRate" DECIMAL(10,4) NOT NULL,
    "eligibleSpend" DECIMAL(12,2) NOT NULL,
    "refundedSpend" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pointsEarned" DECIMAL(16,2) NOT NULL,
    "pointsReversed" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyOrderReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyRedemption" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "status" "LoyaltyRedemptionStatus" NOT NULL DEFAULT 'RESERVED',
    "points" DECIMAL(16,2) NOT NULL,
    "discountNet" DECIMAL(12,2) NOT NULL,
    "discountGross" DECIMAL(12,2) NOT NULL,
    "pointsRestored" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyLotAllocation" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "redemptionId" TEXT,
    "transactionId" TEXT,
    "points" DECIMAL(16,2) NOT NULL,

    CONSTRAINT "LoyaltyLotAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyRefund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "externalReference" VARCHAR(255) NOT NULL,
    "reason" TEXT NOT NULL,
    "eligibleSpend" DECIMAL(12,2) NOT NULL,
    "pointsReversed" DECIMAL(16,2) NOT NULL,
    "pointsRestored" DECIMAL(16,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyAdminAction" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "reason" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyAdminAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyTier_configId_position_key" ON "LoyaltyTier"("configId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyTier_configId_name_key" ON "LoyaltyTier"("configId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyAccount_userId_key" ON "LoyaltyAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyTransaction_idempotencyKey_key" ON "LoyaltyTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_accountId_createdAt_id_idx" ON "LoyaltyTransaction"("accountId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_orderId_idx" ON "LoyaltyTransaction"("orderId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_actorId_idx" ON "LoyaltyTransaction"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyPointsLot_transactionId_key" ON "LoyaltyPointsLot"("transactionId");

-- CreateIndex
CREATE INDEX "LoyaltyPointsLot_accountId_expiresAt_createdAt_idx" ON "LoyaltyPointsLot"("accountId", "expiresAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyOrderReward_orderId_key" ON "LoyaltyOrderReward"("orderId");

-- CreateIndex
CREATE INDEX "LoyaltyOrderReward_accountId_paidAt_idx" ON "LoyaltyOrderReward"("accountId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyRedemption_orderId_key" ON "LoyaltyRedemption"("orderId");

-- CreateIndex
CREATE INDEX "LoyaltyRedemption_accountId_status_idx" ON "LoyaltyRedemption"("accountId", "status");

-- CreateIndex
CREATE INDEX "LoyaltyLotAllocation_redemptionId_idx" ON "LoyaltyLotAllocation"("redemptionId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyLotAllocation_lotId_redemptionId_key" ON "LoyaltyLotAllocation"("lotId", "redemptionId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyLotAllocation_lotId_transactionId_key" ON "LoyaltyLotAllocation"("lotId", "transactionId");

-- CreateIndex
CREATE INDEX "LoyaltyLotAllocation_transactionId_idx" ON "LoyaltyLotAllocation"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyRefund_externalReference_key" ON "LoyaltyRefund"("externalReference");

-- CreateIndex
CREATE INDEX "LoyaltyRefund_orderId_createdAt_idx" ON "LoyaltyRefund"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "LoyaltyRefund_actorId_idx" ON "LoyaltyRefund"("actorId");

-- CreateIndex
CREATE INDEX "LoyaltyAdminAction_actorId_createdAt_idx" ON "LoyaltyAdminAction"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "LoyaltyTier" ADD CONSTRAINT "LoyaltyTier_configId_fkey" FOREIGN KEY ("configId") REFERENCES "LoyaltyProgramConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LoyaltyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyPointsLot" ADD CONSTRAINT "LoyaltyPointsLot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LoyaltyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyPointsLot" ADD CONSTRAINT "LoyaltyPointsLot_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "LoyaltyTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyOrderReward" ADD CONSTRAINT "LoyaltyOrderReward_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyOrderReward" ADD CONSTRAINT "LoyaltyOrderReward_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LoyaltyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRedemption" ADD CONSTRAINT "LoyaltyRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRedemption" ADD CONSTRAINT "LoyaltyRedemption_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LoyaltyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLotAllocation" ADD CONSTRAINT "LoyaltyLotAllocation_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "LoyaltyPointsLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLotAllocation" ADD CONSTRAINT "LoyaltyLotAllocation_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "LoyaltyRedemption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLotAllocation" ADD CONSTRAINT "LoyaltyLotAllocation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "LoyaltyTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRefund" ADD CONSTRAINT "LoyaltyRefund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRefund" ADD CONSTRAINT "LoyaltyRefund_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAdminAction" ADD CONSTRAINT "LoyaltyAdminAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma uses the trusted database connection; public Supabase roles get no
-- direct access to loyalty data. No client-facing RLS policies are installed.
ALTER TABLE "LoyaltyProgramConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoyaltyTier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoyaltyAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoyaltyTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoyaltyPointsLot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoyaltyOrderReward" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoyaltyRedemption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoyaltyLotAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoyaltyRefund" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoyaltyAdminAction" ENABLE ROW LEVEL SECURITY;

-- A single disabled configuration prevents an unfinished program from going live.
ALTER TABLE "LoyaltyProgramConfig"
  ADD CONSTRAINT "LoyaltyProgramConfig_singleton" CHECK ("id" = 'default'),
  ADD CONSTRAINT "LoyaltyProgramConfig_rates" CHECK (
    "baseRate" > 0 AND "pointsPerEuro" > 0 AND "minimumRedemption" > 0
    AND "redemptionIncrement" > 0 AND "maxDiscountPercent" BETWEEN 0 AND 100
    AND "evaluationDays" > 0 AND "expirationMonths" > 0
  );
ALTER TABLE "LoyaltyTier"
  ADD CONSTRAINT "LoyaltyTier_values" CHECK ("position" >= 0 AND "threshold" >= 0 AND "multiplier" > 0);
CREATE UNIQUE INDEX "LoyaltyTier_configId_lower_name_key" ON "LoyaltyTier" ("configId", lower("name"));
ALTER TABLE "LoyaltyTransaction"
  ADD CONSTRAINT "LoyaltyTransaction_nonzero" CHECK ("points" <> 0),
  ADD CONSTRAINT "LoyaltyTransaction_adjustment_actor" CHECK ("type" <> 'ADMIN_ADJUSTMENT' OR "actorId" IS NOT NULL),
  ADD CONSTRAINT "LoyaltyTransaction_order_required" CHECK (
    "type" NOT IN ('PURCHASE_REWARD', 'REDEMPTION') OR "orderId" IS NOT NULL
  ),
  ADD CONSTRAINT "LoyaltyTransaction_sign" CHECK (
    ("type" IN ('PURCHASE_REWARD', 'REDEMPTION_RESTORE', 'PROMOTIONAL_BONUS') AND "points" > 0)
    OR ("type" IN ('REDEMPTION', 'REFUND_REVERSAL', 'EXPIRATION') AND "points" < 0)
    OR "type" = 'ADMIN_ADJUSTMENT'
  );
CREATE UNIQUE INDEX "LoyaltyTransaction_purchase_order_key"
  ON "LoyaltyTransaction" ("orderId") WHERE "type" = 'PURCHASE_REWARD';
CREATE UNIQUE INDEX "LoyaltyTransaction_redemption_order_key"
  ON "LoyaltyTransaction" ("orderId") WHERE "type" = 'REDEMPTION';
ALTER TABLE "LoyaltyPointsLot"
  ADD CONSTRAINT "LoyaltyPointsLot_amounts" CHECK (
    "originalPoints" > 0 AND "remainingPoints" >= 0 AND "remainingPoints" <= "originalPoints"
  );
ALTER TABLE "LoyaltyOrderReward"
  ADD CONSTRAINT "LoyaltyOrderReward_amounts" CHECK (
    "eligibleSpend" >= 0 AND "refundedSpend" BETWEEN 0 AND "eligibleSpend"
    AND "pointsEarned" >= 0 AND "pointsReversed" BETWEEN 0 AND "pointsEarned"
    AND "multiplier" > 0 AND "baseRate" > 0
  );
ALTER TABLE "LoyaltyRedemption"
  ADD CONSTRAINT "LoyaltyRedemption_amounts" CHECK (
    "points" > 0 AND "discountNet" > 0 AND "discountGross" >= "discountNet"
    AND "pointsRestored" BETWEEN 0 AND "points"
  );
ALTER TABLE "LoyaltyLotAllocation"
  ADD CONSTRAINT "LoyaltyLotAllocation_positive" CHECK ("points" > 0),
  ADD CONSTRAINT "LoyaltyLotAllocation_source" CHECK (
    ("redemptionId" IS NULL) <> ("transactionId" IS NULL)
  );
ALTER TABLE "LoyaltyRefund"
  ADD CONSTRAINT "LoyaltyRefund_amounts" CHECK (
    "eligibleSpend" >= 0 AND "pointsReversed" >= 0 AND "pointsRestored" >= 0
  );

CREATE FUNCTION prevent_loyalty_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Loyalty audit records are append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LoyaltyTransaction_append_only" BEFORE UPDATE OR DELETE ON "LoyaltyTransaction"
  FOR EACH ROW EXECUTE FUNCTION prevent_loyalty_audit_mutation();
CREATE TRIGGER "LoyaltyRefund_append_only" BEFORE UPDATE OR DELETE ON "LoyaltyRefund"
  FOR EACH ROW EXECUTE FUNCTION prevent_loyalty_audit_mutation();
CREATE TRIGGER "LoyaltyAdminAction_append_only" BEFORE UPDATE OR DELETE ON "LoyaltyAdminAction"
  FOR EACH ROW EXECUTE FUNCTION prevent_loyalty_audit_mutation();

INSERT INTO "LoyaltyProgramConfig" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP);
INSERT INTO "LoyaltyTier" ("id", "name", "position", "threshold", "multiplier", "icon", "color") VALUES
  ('loyalty-tier-beginner', 'Principiante', 0, 0, 1, 'star', '#9CA3AF'),
  ('loyalty-tier-advanced', 'Avanzado', 1, 500, 1.25, 'sparkles', '#60A5FA'),
  ('loyalty-tier-expert', 'Experto', 2, 1000, 1.5, 'gem', '#C084FC'),
  ('loyalty-tier-god', 'God', 3, 2000, 1.75, 'crown', '#D4AF37');

