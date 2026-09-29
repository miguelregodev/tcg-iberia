-- DropIndex
DROP INDEX "Product_description_trgm_idx";

-- DropIndex
DROP INDEX "Product_name_trgm_idx";

-- DropIndex
DROP INDEX "Product_visible_priority_idx";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "heightCm" DECIMAL(8,2),
ADD COLUMN     "lengthCm" DECIMAL(8,2),
ADD COLUMN     "weightGrams" INTEGER,
ADD COLUMN     "widthCm" DECIMAL(8,2);
