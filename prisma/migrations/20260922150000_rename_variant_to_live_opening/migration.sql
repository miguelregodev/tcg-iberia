-- Rename product variant concept: SHRINK/NO_SHRINK ("Con plástico"/"Sin plástico")
-- becomes SEALED/LIVE_OPENING ("Sellado"/"Apertura en directo"). The live-opening
-- variant is sold at a lower price and opened live on stream instead of shipped
-- unwrapped.

-- Enum values
ALTER TYPE "ProductVariant" RENAME VALUE 'SHRINK' TO 'SEALED';
ALTER TYPE "ProductVariant" RENAME VALUE 'NO_SHRINK' TO 'LIVE_OPENING';

-- Product columns
ALTER TABLE "Product" RENAME COLUMN "noShrinkPrice" TO "liveOpeningPrice";
ALTER TABLE "Product" RENAME COLUMN "noShrinkStock" TO "liveOpeningStock";

-- B2B (wholesale) customers now only ever get a single "Sellado" price.
ALTER TABLE "Product" DROP COLUMN "b2bPriceNoShrink";
