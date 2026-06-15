ALTER TABLE "Product"
ADD COLUMN "releaseDate" TIMESTAMP(3);

CREATE INDEX "Product_releaseDate_idx" ON "Product"("releaseDate");