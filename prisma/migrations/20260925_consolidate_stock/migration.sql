-- Drop the liveOpeningStock column from Product table
-- Both sealed and live-opening variants now share the single stock attribute
ALTER TABLE "Product" DROP COLUMN IF EXISTS "liveOpeningStock";
