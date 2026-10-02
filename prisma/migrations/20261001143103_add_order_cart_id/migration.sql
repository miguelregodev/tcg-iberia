-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cartId" VARCHAR(100);

-- CreateIndex
CREATE INDEX "Order_cartId_idx" ON "Order"("cartId");
