-- Preserve existing user-linked audit records while supporting the shared
-- backoffice identity used by the rest of the administration panel.
ALTER TABLE "LoyaltyTransaction" ADD COLUMN "adminActor" TEXT;
ALTER TABLE "LoyaltyAdminAction"
  ALTER COLUMN "actorId" DROP NOT NULL,
  ADD COLUMN "adminActor" TEXT;
ALTER TABLE "LoyaltyAdminAction"
  ADD CONSTRAINT "LoyaltyAdminAction_actor_check"
  CHECK ("actorId" IS NOT NULL OR NULLIF(BTRIM("adminActor"), '') IS NOT NULL);
