-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'TELEGRAM');

-- AlterTable
ALTER TABLE "StockAlert" ADD COLUMN     "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL';
