-- ─────────────────────────────────────────────────────────────────────────────
-- B2B Orders + Invoices
--
-- Adds the wholesale order request table, the accompanying status enum,
-- and seeds the two Sequence rows used to hand out sequential order and
-- invoice numbers.
--
-- Design notes:
--   - `items` is JSONB so we can snapshot each line's name, variant, price
--     and quantity at request time. This keeps historical invoices stable
--     even if the underlying product is later renamed or repriced.
--   - Money columns are net of tax. `ivaAmount` is 21% of `subtotal` and
--     `total = subtotal + ivaAmount`.
--   - `invoiceNumber` is nullable — it is populated when the admin accepts
--     the order and the PDF invoice is generated.
--   - Foreign key uses ON DELETE RESTRICT so we cannot accidentally purge
--     a B2B customer while any of their orders still exist (financial
--     records must be preserved).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Enum ─────────────────────────────────────────────────────────────────────
CREATE TYPE "B2bOrderStatus" AS ENUM (
  'PENDING', 'ACCEPTED', 'PAID', 'CANCELLED', 'REJECTED'
);

-- 2. Table ────────────────────────────────────────────────────────────────────
CREATE TABLE "B2bOrder" (
    "id"             TEXT NOT NULL,
    "customerId"     TEXT NOT NULL,
    "orderNumber"    VARCHAR(50) NOT NULL,
    "status"         "B2bOrderStatus" NOT NULL DEFAULT 'PENDING',
    "items"          JSONB NOT NULL,
    "subtotal"       DECIMAL(12, 2) NOT NULL,
    "ivaAmount"      DECIMAL(12, 2) NOT NULL,
    "total"          DECIMAL(12, 2) NOT NULL,
    "invoiceNumber"  VARCHAR(50),
    "invoicedAt"     TIMESTAMP(3),
    "acceptedAt"     TIMESTAMP(3),
    "rejectedAt"     TIMESTAMP(3),
    "paidAt"         TIMESTAMP(3),
    "cancelledAt"    TIMESTAMP(3),
    "cancelledBy"    VARCHAR(120),
    "notes"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "B2bOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "B2bOrder_orderNumber_key"    ON "B2bOrder"("orderNumber");
CREATE UNIQUE INDEX "B2bOrder_invoiceNumber_key"  ON "B2bOrder"("invoiceNumber");
CREATE INDEX "B2bOrder_customerId_idx"            ON "B2bOrder"("customerId");
CREATE INDEX "B2bOrder_status_idx"                ON "B2bOrder"("status");
CREATE INDEX "B2bOrder_createdAt_idx"             ON "B2bOrder"("createdAt");

ALTER TABLE "B2bOrder"
  ADD CONSTRAINT "B2bOrder_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "B2bCustomer"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Seed sequence rows ───────────────────────────────────────────────────────
--    The application increments these atomically via `Sequence` upserts
--    (see src/lib/b2b/order-numbers.ts). Using an existing table for the
--    counters keeps them transactional with the surrounding order write.
INSERT INTO "Sequence" ("name", "value")
  VALUES ('B2B_ORDER', 0), ('B2B_INVOICE', 0)
  ON CONFLICT ("name") DO NOTHING;
