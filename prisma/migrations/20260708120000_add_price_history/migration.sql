-- CreateEnum
CREATE TYPE "ProductVariant" AS ENUM ('SHRINK', 'NO_SHRINK');

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "catalogProductId" TEXT NOT NULL,
    "variant" "ProductVariant" NOT NULL,
    "sheetProductName" VARCHAR(500) NOT NULL,
    "importDate" DATE NOT NULL,
    "importTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priceJpy" DECIMAL(12,2) NOT NULL,
    "exchangeRate" DECIMAL(18,10) NOT NULL,
    "purchasePriceEur" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceHistory_catalogProductId_variant_importDate_key" ON "PriceHistory"("catalogProductId", "variant", "importDate");

-- CreateIndex
CREATE INDEX "PriceHistory_catalogProductId_variant_importDate_idx" ON "PriceHistory"("catalogProductId", "variant", "importDate");

-- CreateIndex
CREATE INDEX "PriceHistory_catalogProductId_variant_purchasePriceEur_idx" ON "PriceHistory"("catalogProductId", "variant", "purchasePriceEur");

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_catalogProductId_fkey" FOREIGN KEY ("catalogProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
