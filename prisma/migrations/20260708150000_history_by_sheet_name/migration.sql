-- ─────────────────────────────────────────────────────────────────────────────
-- Rework PriceHistory to be keyed by the imported sheet product name instead of
-- the catalog product ID. This lets the historical price chart show every
-- imported price — including imports that were never matched to a catalog
-- product — and preserves historical data even if the catalog product is
-- later deleted.
--
-- Changes:
--   1. Drop the FK / unique / indexes that were scoped to catalogProductId.
--   2. Relax "PriceHistory"."catalogProductId" to be nullable.
--   3. Re-create the FK with ON DELETE SET NULL (was CASCADE).
--   4. Add a new unique constraint on (sheetProductName, variant, importDate).
--   5. Add indexes on (sheetProductName, variant, importDate) and
--      (sheetProductName, variant, purchasePriceEur) for chart / MIN queries.
--   6. Add a plain index on catalogProductId so joins from Product still scan
--      the child table efficiently.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop existing constraints and indexes that reference catalogProductId first.
ALTER TABLE "PriceHistory" DROP CONSTRAINT IF EXISTS "PriceHistory_catalogProductId_fkey";
DROP INDEX IF EXISTS "PriceHistory_catalogProductId_variant_importDate_key";
DROP INDEX IF EXISTS "PriceHistory_catalogProductId_variant_importDate_idx";
DROP INDEX IF EXISTS "PriceHistory_catalogProductId_variant_purchasePriceEur_idx";

-- 2. Make catalogProductId nullable so unmatched imports can be recorded.
ALTER TABLE "PriceHistory" ALTER COLUMN "catalogProductId" DROP NOT NULL;

-- 3. Re-attach the FK with SET NULL so deleting a catalog product preserves
--    its price history (the sheetProductName column keeps the identity).
ALTER TABLE "PriceHistory"
  ADD CONSTRAINT "PriceHistory_catalogProductId_fkey"
  FOREIGN KEY ("catalogProductId") REFERENCES "Product"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. New unique key: at most one row per (imported name, variant, day).
CREATE UNIQUE INDEX "PriceHistory_sheetProductName_variant_importDate_key"
  ON "PriceHistory"("sheetProductName", "variant", "importDate");

-- 5. Indexes that back chart lookups (ordered by day) and historical-min
--    lookups (ordered by price).
CREATE INDEX "PriceHistory_sheetProductName_variant_importDate_idx"
  ON "PriceHistory"("sheetProductName", "variant", "importDate");

CREATE INDEX "PriceHistory_sheetProductName_variant_purchasePriceEur_idx"
  ON "PriceHistory"("sheetProductName", "variant", "purchasePriceEur");

-- 6. Support joins from Product → PriceHistory (used when displaying history
--    attached to a specific catalog product).
CREATE INDEX "PriceHistory_catalogProductId_idx"
  ON "PriceHistory"("catalogProductId");
