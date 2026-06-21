-- ============================================================================
-- Product search performance indexes
-- ============================================================================
-- Adds trigram (pg_trgm) GIN indexes on the columns the live + full-page
-- search query against (`/api/search`). Without these, the Postgres planner
-- has to seq-scan the entire Product table for every keystroke because
-- B-tree indexes cannot accelerate `ILIKE '%token%'` substring matches.
--
-- After this migration, queries of the form:
--
--   SELECT ... FROM "Product"
--   WHERE visible = true
--     AND ("name" ILIKE '%storm%'
--      OR  "type" ILIKE '%storm%'
--      OR  "description" ILIKE '%storm%')
--
-- can use bitmap-index scans on the trigram GIN indexes and combine them
-- with the existing `Product_visible_idx` / `Product_priority_idx`.
-- ============================================================================

-- 1) Enable the pg_trgm extension (idempotent — safe to run multiple times).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2) GIN trigram index on Product.name (primary search target, most weight in
--    relevance scoring).
CREATE INDEX IF NOT EXISTS "Product_name_trgm_idx"
  ON "Product" USING GIN ("name" gin_trgm_ops);

-- 3) GIN trigram index on Product.type. Partial — skips rows where type is
--    NULL, which keeps the index smaller and the planner happier.
CREATE INDEX IF NOT EXISTS "Product_type_trgm_idx"
  ON "Product" USING GIN ("type" gin_trgm_ops)
  WHERE "type" IS NOT NULL;

-- 4) GIN trigram index on Product.description (longer text, lowest scoring
--    weight in search, but still needs to be searchable).
CREATE INDEX IF NOT EXISTS "Product_description_trgm_idx"
  ON "Product" USING GIN ("description" gin_trgm_ops);

-- 5) Composite B-tree index on (visible, priority) — accelerates the
--    `WHERE visible = true ORDER BY priority ASC` access path used both by
--    the search API after trigram filtering and by every catalog list page.
CREATE INDEX IF NOT EXISTS "Product_visible_priority_idx"
  ON "Product" ("visible", "priority");
