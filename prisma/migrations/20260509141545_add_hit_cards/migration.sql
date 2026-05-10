-- CreateTable
CREATE TABLE "HitCard" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "imageUrl" VARCHAR(500) NOT NULL,
    "marketPrice" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HitCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HitCard_productId_idx" ON "HitCard"("productId");

-- AddForeignKey
ALTER TABLE "HitCard" ADD CONSTRAINT "HitCard_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
