-- CreateTable
CREATE TABLE "PriceMapping" (
    "id" TEXT NOT NULL,
    "importedName" VARCHAR(500) NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceMapping_importedName_key" ON "PriceMapping"("importedName");

-- CreateIndex
CREATE INDEX "PriceMapping_importedName_idx" ON "PriceMapping"("importedName");

-- CreateIndex
CREATE INDEX "PriceMapping_productId_idx" ON "PriceMapping"("productId");

-- AddForeignKey
ALTER TABLE "PriceMapping" ADD CONSTRAINT "PriceMapping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
