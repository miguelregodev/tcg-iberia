ALTER TABLE "PartyParticipation"
  ADD COLUMN "redsysOrderId" VARCHAR(12),
  ADD COLUMN "redsysTransactionId" VARCHAR(50);

CREATE UNIQUE INDEX "PartyParticipation_redsysOrderId_key"
  ON "PartyParticipation"("redsysOrderId");
