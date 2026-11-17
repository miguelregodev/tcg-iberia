-- CreateEnum
CREATE TYPE "LotteryStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'FINISHED', 'DRAWN', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LotteryParticipationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LotteryPurchasePlatform" AS ENUM ('TIKTOK', 'WEBSITE');

-- CreateEnum
CREATE TYPE "LotteryRejectionReason" AS ENUM ('INVALID_ORDER_DATE', 'MINIMUM_AMOUNT_NOT_MET', 'ORDER_NOT_FOUND', 'OTHER');

-- CreateTable
CREATE TABLE "Lottery" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "prize" VARCHAR(255) NOT NULL,
    "prizeImageUrl" VARCHAR(500),
    "description" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "minimumOrderAmount" DECIMAL(10,2),
    "status" "LotteryStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" VARCHAR(255) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "drawnAt" TIMESTAMP(3),
    "drawnById" VARCHAR(255),
    "eligibleCountAtDraw" INTEGER,
    "winnerParticipationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lottery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotteryParticipation" (
    "id" TEXT NOT NULL,
    "lotteryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmailSnapshot" VARCHAR(255) NOT NULL,
    "orderNumber" VARCHAR(50) NOT NULL,
    "normalizedOrderNumber" VARCHAR(50) NOT NULL,
    "platform" "LotteryPurchasePlatform" NOT NULL,
    "tiktokUsername" VARCHAR(60),
    "orderDate" DATE NOT NULL,
    "status" "LotteryParticipationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" "LotteryRejectionReason",
    "rejectionReasonDetails" VARCHAR(500),
    "reviewedById" VARCHAR(255),
    "reviewedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LotteryParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotteryAuditLog" (
    "id" TEXT NOT NULL,
    "lotteryId" TEXT NOT NULL,
    "participationId" VARCHAR(255),
    "action" VARCHAR(100) NOT NULL,
    "adminId" VARCHAR(255),
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LotteryAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lottery_slug_key" ON "Lottery"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Lottery_winnerParticipationId_key" ON "Lottery"("winnerParticipationId");

-- CreateIndex
CREATE INDEX "Lottery_status_startDate_idx" ON "Lottery"("status", "startDate");

-- CreateIndex
CREATE INDEX "Lottery_status_endDate_idx" ON "Lottery"("status", "endDate");

-- CreateIndex
CREATE INDEX "LotteryParticipation_lotteryId_status_idx" ON "LotteryParticipation"("lotteryId", "status");

-- CreateIndex
CREATE INDEX "LotteryParticipation_userId_idx" ON "LotteryParticipation"("userId");

-- CreateIndex
CREATE INDEX "LotteryParticipation_orderNumber_idx" ON "LotteryParticipation"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LotteryParticipation_lotteryId_normalizedOrderNumber_key" ON "LotteryParticipation"("lotteryId", "normalizedOrderNumber");

-- CreateIndex
CREATE INDEX "LotteryAuditLog_lotteryId_createdAt_idx" ON "LotteryAuditLog"("lotteryId", "createdAt");

-- AddForeignKey
ALTER TABLE "Lottery" ADD CONSTRAINT "Lottery_winnerParticipationId_fkey" FOREIGN KEY ("winnerParticipationId") REFERENCES "LotteryParticipation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryParticipation" ADD CONSTRAINT "LotteryParticipation_lotteryId_fkey" FOREIGN KEY ("lotteryId") REFERENCES "Lottery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryParticipation" ADD CONSTRAINT "LotteryParticipation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryAuditLog" ADD CONSTRAINT "LotteryAuditLog_lotteryId_fkey" FOREIGN KEY ("lotteryId") REFERENCES "Lottery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
