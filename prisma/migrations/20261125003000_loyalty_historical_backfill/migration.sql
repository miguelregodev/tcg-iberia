ALTER TABLE "LoyaltyAccount"
  ADD COLUMN "historicalBackfillAt" TIMESTAMP(3),
  ADD COLUMN "historicalBackfillBy" TEXT;
ALTER TABLE "LoyaltyAccount"
  ADD CONSTRAINT "LoyaltyAccount_historical_backfill_actor" CHECK (
    "historicalBackfillAt" IS NULL OR NULLIF(BTRIM("historicalBackfillBy"), '') IS NOT NULL
  );
