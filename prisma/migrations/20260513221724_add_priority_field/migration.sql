-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 999;

-- CreateIndex
CREATE INDEX "Product_priority_idx" ON "Product"("priority");
