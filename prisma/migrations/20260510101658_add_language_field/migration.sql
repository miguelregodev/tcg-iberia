-- CreateEnum
CREATE TYPE "Language" AS ENUM ('JAPANESE', 'KOREAN', 'ENGLISH', 'SPANISH');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "language" "Language" NOT NULL DEFAULT 'ENGLISH';

-- CreateIndex
CREATE INDEX "Product_language_idx" ON "Product"("language");
