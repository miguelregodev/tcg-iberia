-- CreateEnum
CREATE TYPE "ShippingProvider" AS ENUM ('CORREOS', 'MRW', 'SEUR', 'CTT_EXPRESS');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'SHIPPED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "shippingProvider" "ShippingProvider",
ADD COLUMN     "trackingNumber" VARCHAR(100);
