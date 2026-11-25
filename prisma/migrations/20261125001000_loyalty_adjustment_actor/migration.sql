ALTER TABLE "LoyaltyTransaction"
  DROP CONSTRAINT "LoyaltyTransaction_adjustment_actor",
  ADD CONSTRAINT "LoyaltyTransaction_adjustment_actor" CHECK (
    "type" <> 'ADMIN_ADJUSTMENT'
    OR "actorId" IS NOT NULL
    OR NULLIF(BTRIM("adminActor"), '') IS NOT NULL
  );
