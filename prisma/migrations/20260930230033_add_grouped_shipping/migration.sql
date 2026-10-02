-- CreateEnum
CREATE TYPE "ShippingMode" AS ENUM ('IMMEDIATE', 'GROUPED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shipmentId" TEXT,
ADD COLUMN     "shippingMode" "ShippingMode" NOT NULL DEFAULT 'IMMEDIATE';

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "shipmentNumber" VARCHAR(50) NOT NULL,
    "userId" TEXT NOT NULL,
    "merchandiseTotal" DECIMAL(12,2) NOT NULL,
    "shippingCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentProvider" VARCHAR(50),
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PAID',
    "redsysOrderId" VARCHAR(12),
    "redsysTransactionId" VARCHAR(50),
    "redsysResponseCode" VARCHAR(10),
    "redsysAuthCode" VARCHAR(50),
    "paymentPaidAt" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_shipmentNumber_key" ON "Shipment"("shipmentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_redsysOrderId_key" ON "Shipment"("redsysOrderId");

-- CreateIndex
CREATE INDEX "Shipment_userId_idx" ON "Shipment"("userId");

-- CreateIndex
CREATE INDEX "Shipment_paymentStatus_idx" ON "Shipment"("paymentStatus");

-- CreateIndex
CREATE INDEX "Order_shippingMode_idx" ON "Order"("shippingMode");

-- CreateIndex
CREATE INDEX "Order_shipmentId_idx" ON "Order"("shipmentId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
