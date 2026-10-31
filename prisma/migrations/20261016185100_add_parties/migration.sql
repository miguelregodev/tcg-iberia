CREATE TYPE "PartyStatus" AS ENUM ('OPEN', 'FULL', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "PartyParticipationStatus" AS ENUM (
  'PENDING_PAYMENT',
  'PAID',
  'EXPIRED',
  'CANCELLED',
  'REFUND_REQUESTED',
  'REFUNDED',
  'REFUND_REQUIRED'
);
CREATE TYPE "PartyRefundStatus" AS ENUM ('NONE', 'REQUESTED', 'REJECTED', 'APPROVED');

CREATE TABLE "Party" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "boxPrice" DECIMAL(10,2) NOT NULL,
  "packsPerBox" INTEGER NOT NULL,
  "participantCount" INTEGER NOT NULL,
  "packsPerParticipant" INTEGER NOT NULL,
  "participationPrice" DECIMAL(10,2) NOT NULL,
  "status" "PartyStatus" NOT NULL DEFAULT 'OPEN',
  "internalNotes" TEXT,
  "tiktokLiveUrl" VARCHAR(500),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "inventoryReleased" BOOLEAN NOT NULL DEFAULT false,
  "createdByAdminId" VARCHAR(255),
  "winnerParticipationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Party_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Party_pack_distribution_check" CHECK (
    "packsPerBox" > 0
    AND "participantCount" >= 2
    AND "participantCount" < "packsPerBox"
    AND MOD("packsPerBox", "participantCount") = 0
    AND "packsPerParticipant" = "packsPerBox" / "participantCount"
  ),
  CONSTRAINT "Party_exact_price_split_check" CHECK (
    "boxPrice" > 0
    AND "participationPrice" > 0
    AND MOD(("boxPrice" * 100)::BIGINT, "participantCount") = 0
    AND "participationPrice" * "participantCount" = "boxPrice"
  )
);

CREATE TABLE "PartyParticipation" (
  "id" TEXT NOT NULL,
  "partyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "slotNumber" INTEGER,
  "status" "PartyParticipationStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "refundStatus" "PartyRefundStatus" NOT NULL DEFAULT 'NONE',
  "amountPaid" DECIMAL(10,2) NOT NULL,
  "stripeCheckoutSessionId" VARCHAR(255),
  "stripePaymentIntentId" VARCHAR(255),
  "orderId" TEXT,
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reservationExpiresAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "refundedAt" TIMESTAMP(3),
  "shippingRequestedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartyParticipation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartyAuditLog" (
  "id" TEXT NOT NULL,
  "partyId" TEXT NOT NULL,
  "action" VARCHAR(100) NOT NULL,
  "adminId" VARCHAR(255),
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartyAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Party_winnerParticipationId_key" ON "Party"("winnerParticipationId");
CREATE INDEX "Party_status_createdAt_idx" ON "Party"("status", "createdAt");
CREATE INDEX "Party_productId_idx" ON "Party"("productId");
CREATE UNIQUE INDEX "PartyParticipation_stripeCheckoutSessionId_key" ON "PartyParticipation"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "PartyParticipation_stripePaymentIntentId_key" ON "PartyParticipation"("stripePaymentIntentId");
CREATE UNIQUE INDEX "PartyParticipation_orderId_key" ON "PartyParticipation"("orderId");
CREATE UNIQUE INDEX "PartyParticipation_partyId_slotNumber_key" ON "PartyParticipation"("partyId", "slotNumber");
CREATE INDEX "PartyParticipation_partyId_status_idx" ON "PartyParticipation"("partyId", "status");
CREATE INDEX "PartyParticipation_userId_partyId_idx" ON "PartyParticipation"("userId", "partyId");
CREATE INDEX "PartyParticipation_reservationExpiresAt_idx" ON "PartyParticipation"("reservationExpiresAt");
CREATE UNIQUE INDEX "PartyParticipation_one_active_user_party_key"
  ON "PartyParticipation"("partyId", "userId")
  WHERE "status" IN ('PENDING_PAYMENT', 'PAID', 'REFUND_REQUESTED');
CREATE INDEX "PartyAuditLog_partyId_createdAt_idx" ON "PartyAuditLog"("partyId", "createdAt");

ALTER TABLE "CheckoutSessionCart"
  ADD COLUMN "inventoryConflictAt" TIMESTAMP(3);

ALTER TABLE "Party"
  ADD CONSTRAINT "Party_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartyParticipation"
  ADD CONSTRAINT "PartyParticipation_partyId_fkey"
  FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartyParticipation"
  ADD CONSTRAINT "PartyParticipation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartyParticipation"
  ADD CONSTRAINT "PartyParticipation_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Party"
  ADD CONSTRAINT "Party_winnerParticipationId_fkey"
  FOREIGN KEY ("winnerParticipationId") REFERENCES "PartyParticipation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartyAuditLog"
  ADD CONSTRAINT "PartyAuditLog_partyId_fkey"
  FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;
