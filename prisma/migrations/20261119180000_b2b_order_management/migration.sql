-- ─────────────────────────────────────────────────────────────────────────────
-- B2B order management: independent statuses, documents, audit trail
--
--   1. New enums (payment / fulfillment / source / document / event types).
--   2. New B2bOrder columns + backfill of legacy rows:
--        - status PAID  -> status ACCEPTED + paymentStatus PAID
--        - CANCELLED / REJECTED orders -> fulfillmentStatus CANCELLED
--        - customerSnapshot copied from the current B2bCustomer row
--   3. B2bOrderStatus enum recreated without the legacy PAID value.
--   4. B2bDocument + B2bOrderEvent tables.
--   5. Legacy invoice numbers moved into B2bDocument rows (status FAILED with
--      an explanatory message: the PDF was never stored, so an admin must
--      "retry" to render + store it in the private bucket). The number and
--      issue date are preserved verbatim (AEAT: no renumbering).
--   6. Legacy invoiceNumber / invoicedAt columns dropped.
--   7. Sequence rows for the new document series.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Enums
CREATE TYPE "B2bPaymentStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'CANCELLED');
CREATE TYPE "B2bFulfillmentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED');
CREATE TYPE "B2bOrderSource" AS ENUM ('CUSTOMER', 'ADMIN');
CREATE TYPE "B2bDocumentType" AS ENUM ('INVOICE', 'PROFORMA', 'QUOTATION', 'CORRECTIVE_INVOICE');
CREATE TYPE "B2bDocumentStatus" AS ENUM ('GENERATING', 'ISSUED', 'FAILED');
CREATE TYPE "B2bOrderEventType" AS ENUM ('ORDER_CREATED', 'ORDER_CREATED_BY_ADMIN', 'ORDER_ACCEPTED', 'ORDER_REJECTED', 'ORDER_UPDATED', 'ORDER_CANCELLED', 'PAYMENT_STATUS_CHANGED', 'FULFILLMENT_STATUS_CHANGED', 'ORDER_SHIPPED', 'ORDER_DELIVERED', 'ORDER_RETURNED', 'TRACKING_UPDATED', 'CARRIER_CHANGED', 'ADMIN_NOTE_UPDATED', 'CUSTOMER_NOTE_UPDATED', 'DOCUMENT_GENERATED', 'DOCUMENT_GENERATION_FAILED', 'DOCUMENT_GENERATION_RETRIED', 'DOCUMENT_EMAIL_SENT', 'DOCUMENT_EMAIL_FAILED', 'SHIPPING_EMAIL_SENT', 'SHIPPING_EMAIL_FAILED', 'SHIPPING_EMAIL_RETRIED');

-- 2. New B2bOrder columns
ALTER TABLE "B2bOrder"
ADD COLUMN "cancellationReason" TEXT,
ADD COLUMN "createdBy" VARCHAR(120),
ADD COLUMN "customerSnapshot" JSONB,
ADD COLUMN "deliveredAt" TIMESTAMP(3),
ADD COLUMN "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "fulfillmentStatus" "B2bFulfillmentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "idempotencyKey" VARCHAR(100),
ADD COLUMN "internalNotes" TEXT,
ADD COLUMN "paymentMethod" VARCHAR(60),
ADD COLUMN "paymentReference" VARCHAR(120),
ADD COLUMN "paymentStatus" "B2bPaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "processingAt" TIMESTAMP(3),
ADD COLUMN "refundedAt" TIMESTAMP(3),
ADD COLUMN "returnReason" TEXT,
ADD COLUMN "returnedAt" TIMESTAMP(3),
ADD COLUMN "shippedAt" TIMESTAMP(3),
ADD COLUMN "shippingCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "shippingEmailError" VARCHAR(500),
ADD COLUMN "shippingEmailSentAt" TIMESTAMP(3),
ADD COLUMN "shippingProvider" "ShippingProvider",
ADD COLUMN "source" "B2bOrderSource" NOT NULL DEFAULT 'CUSTOMER',
ADD COLUMN "trackingNumber" VARCHAR(100),
ADD COLUMN "vatRate" DECIMAL(5,4) NOT NULL DEFAULT 0.21;

-- Backfill: split the legacy conflated status.
UPDATE "B2bOrder" SET "paymentStatus" = 'PAID' WHERE "status" = 'PAID';
UPDATE "B2bOrder" SET "status" = 'ACCEPTED' WHERE "status" = 'PAID';
UPDATE "B2bOrder" SET "fulfillmentStatus" = 'CANCELLED' WHERE "status" IN ('CANCELLED', 'REJECTED');
UPDATE "B2bOrder" SET "createdBy" = 'customer' WHERE "createdBy" IS NULL;

UPDATE "B2bOrder" o SET "customerSnapshot" = jsonb_build_object(
  'companyName', c."companyName",
  'vatNumber', c."vatNumber",
  'contactName', c."contactName",
  'email', c."email",
  'phone', c."phone",
  'billingAddress', c."billingAddress",
  'shippingAddress', c."shippingAddress"
)
FROM "B2bCustomer" c
WHERE c."id" = o."customerId";

ALTER TABLE "B2bOrder" ALTER COLUMN "customerSnapshot" SET NOT NULL;

-- 3. Recreate B2bOrderStatus without PAID
CREATE TYPE "B2bOrderStatus_new" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED', 'REJECTED');
ALTER TABLE "B2bOrder" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "B2bOrder" ALTER COLUMN "status" TYPE "B2bOrderStatus_new" USING ("status"::text::"B2bOrderStatus_new");
ALTER TYPE "B2bOrderStatus" RENAME TO "B2bOrderStatus_old";
ALTER TYPE "B2bOrderStatus_new" RENAME TO "B2bOrderStatus";
DROP TYPE "B2bOrderStatus_old";
ALTER TABLE "B2bOrder" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- 4. Documents + audit tables
CREATE TABLE "B2bDocument" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "B2bDocumentType" NOT NULL,
    "status" "B2bDocumentStatus" NOT NULL DEFAULT 'GENERATING',
    "number" VARCHAR(50) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "payload" JSONB,
    "storageKey" VARCHAR(500),
    "fileName" VARCHAR(255),
    "fileSize" INTEGER,
    "generatedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" VARCHAR(500),
    "lastAttemptAt" TIMESTAMP(3),
    "uniquenessKey" VARCHAR(120),
    "correctsDocumentId" TEXT,
    "correctionReason" TEXT,
    "createdBy" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "B2bDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "B2bOrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "B2bOrderEventType" NOT NULL,
    "actor" VARCHAR(120),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "B2bOrderEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "B2bDocument_number_key" ON "B2bDocument"("number");
CREATE UNIQUE INDEX "B2bDocument_storageKey_key" ON "B2bDocument"("storageKey");
CREATE UNIQUE INDEX "B2bDocument_uniquenessKey_key" ON "B2bDocument"("uniquenessKey");
CREATE INDEX "B2bDocument_orderId_idx" ON "B2bDocument"("orderId");
CREATE INDEX "B2bDocument_customerId_idx" ON "B2bDocument"("customerId");
CREATE INDEX "B2bDocument_type_status_idx" ON "B2bDocument"("type", "status");
CREATE INDEX "B2bOrderEvent_orderId_createdAt_idx" ON "B2bOrderEvent"("orderId", "createdAt");
CREATE UNIQUE INDEX "B2bOrder_idempotencyKey_key" ON "B2bOrder"("idempotencyKey");
CREATE INDEX "B2bOrder_paymentStatus_idx" ON "B2bOrder"("paymentStatus");
CREATE INDEX "B2bOrder_fulfillmentStatus_idx" ON "B2bOrder"("fulfillmentStatus");
CREATE INDEX "B2bOrder_source_idx" ON "B2bOrder"("source");
CREATE INDEX "B2bOrder_total_idx" ON "B2bOrder"("total");

ALTER TABLE "B2bDocument" ADD CONSTRAINT "B2bDocument_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "B2bOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "B2bDocument" ADD CONSTRAINT "B2bDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "B2bCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "B2bDocument" ADD CONSTRAINT "B2bDocument_correctsDocumentId_fkey" FOREIGN KEY ("correctsDocumentId") REFERENCES "B2bDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "B2bOrderEvent" ADD CONSTRAINT "B2bOrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "B2bOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Legacy invoices -> B2bDocument
INSERT INTO "B2bDocument" (
  "id", "orderId", "customerId", "type", "status", "number", "issuedAt", "total",
  "attempts", "lastError", "uniquenessKey", "createdBy", "createdAt", "updatedAt"
)
SELECT
  'legacy_' || o."id", o."id", o."customerId", 'INVOICE', 'FAILED', o."invoiceNumber",
  COALESCE(o."invoicedAt", o."acceptedAt", o."createdAt"), o."total",
  0, 'Factura anterior al almacenamiento privado: pulsa "Reintentar" para generar y guardar el PDF.',
  o."id" || ':INVOICE', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "B2bOrder" o
WHERE o."invoiceNumber" IS NOT NULL;

INSERT INTO "B2bOrderEvent" ("id", "orderId", "type", "actor", "metadata", "createdAt")
SELECT 'legacy_created_' || o."id", o."id", 'ORDER_CREATED', 'customer',
       jsonb_build_object('legacy', true), o."createdAt"
FROM "B2bOrder" o;

-- 6. Drop legacy invoice columns
DROP INDEX "B2bOrder_invoiceNumber_key";
ALTER TABLE "B2bOrder" DROP COLUMN "invoiceNumber", DROP COLUMN "invoicedAt";

-- 7. Document number series
INSERT INTO "Sequence" ("name", "value")
  VALUES ('B2B_PROFORMA', 0), ('B2B_QUOTATION', 0), ('B2B_CORRECTIVE', 0)
  ON CONFLICT ("name") DO NOTHING;
