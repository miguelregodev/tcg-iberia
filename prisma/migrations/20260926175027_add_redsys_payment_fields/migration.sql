/*
  Warnings:

  - A unique constraint covering the columns `[redsysOrderId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentAmount" DECIMAL(12,2),
ADD COLUMN     "paymentCurrency" VARCHAR(3),
ADD COLUMN     "paymentPaidAt" TIMESTAMP(3),
ADD COLUMN     "paymentProvider" VARCHAR(50) NOT NULL DEFAULT 'redsys',
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
ADD COLUMN     "redsysAuthCode" VARCHAR(50),
ADD COLUMN     "redsysOrderId" VARCHAR(12),
ADD COLUMN     "redsysResponseCode" VARCHAR(10),
ADD COLUMN     "redsysTransactionId" VARCHAR(50);

-- CreateIndex
CREATE UNIQUE INDEX "Order_redsysOrderId_key" ON "Order"("redsysOrderId");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");

-- CreateIndex
CREATE INDEX "Order_redsysOrderId_idx" ON "Order"("redsysOrderId");
