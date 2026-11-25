ALTER TABLE "LoyaltyTransaction" ADD COLUMN "sequence" BIGSERIAL NOT NULL;
CREATE UNIQUE INDEX "LoyaltyTransaction_sequence_key" ON "LoyaltyTransaction"("sequence");
CREATE INDEX "LoyaltyTransaction_accountId_sequence_idx" ON "LoyaltyTransaction"("accountId", "sequence");
