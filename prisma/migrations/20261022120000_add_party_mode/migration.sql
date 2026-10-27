-- CreateEnum
CREATE TYPE "PartyMode" AS ENUM ('SHARED', 'BATTLE');

-- AlterTable: existing Parties were winner-takes-all, so they keep BATTLE behaviour.
ALTER TABLE "Party" ADD COLUMN "mode" "PartyMode" NOT NULL DEFAULT 'BATTLE';
