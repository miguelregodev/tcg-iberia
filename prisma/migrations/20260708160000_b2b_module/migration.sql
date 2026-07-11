-- ─────────────────────────────────────────────────────────────────────────────
-- B2B (Wholesale) Module
--
-- Creates the tables and enums required for the B2B request/customer workflow
-- and adds optional wholesale price columns to the existing Product table.
--
-- All B2B tables are keyed by CUID and cascade correctly when a customer is
-- deleted (sessions, activation tokens). Login audits keep a soft reference
-- so the audit trail survives account removal.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Enums ────────────────────────────────────────────────────────────────────
CREATE TYPE "B2bRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "B2bCustomerStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');
CREATE TYPE "B2bActivity" AS ENUM ('ONLINE_STORE', 'VENDING_MACHINE', 'PHYSICAL_STORE', 'DISTRIBUTOR', 'OTHER');

-- 2. Wholesale price columns on Product ──────────────────────────────────────
ALTER TABLE "Product" ADD COLUMN "b2bPrice"         DECIMAL(10, 2);
ALTER TABLE "Product" ADD COLUMN "b2bPriceNoShrink" DECIMAL(10, 2);

-- 3. B2bCustomer table (referenced by B2bRequest below) ──────────────────────
CREATE TABLE "B2bCustomer" (
    "id"                 TEXT NOT NULL,
    "email"              VARCHAR(255) NOT NULL,
    "passwordHash"       VARCHAR(255),
    "status"             "B2bCustomerStatus" NOT NULL DEFAULT 'PENDING',
    "companyName"        VARCHAR(255) NOT NULL,
    "vatNumber"          VARCHAR(64) NOT NULL,
    "activity"           "B2bActivity" NOT NULL,
    "activityOther"      VARCHAR(255),
    "shippingAddress"    TEXT NOT NULL,
    "billingAddress"     TEXT,
    "contactName"        VARCHAR(255) NOT NULL,
    "nationalId"         VARCHAR(64),
    "phone"              VARCHAR(30) NOT NULL,
    "website"            VARCHAR(500),
    "estimatedVolume"    VARCHAR(255),
    "preferredLanguages" VARCHAR(255),
    "notes"              TEXT,
    "lastLoginAt"        TIMESTAMP(3),
    "disabledAt"         TIMESTAMP(3),
    "activatedAt"        TIMESTAMP(3),
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "B2bCustomer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "B2bCustomer_email_key" ON "B2bCustomer"("email");
CREATE INDEX "B2bCustomer_status_idx" ON "B2bCustomer"("status");
CREATE INDEX "B2bCustomer_email_idx"  ON "B2bCustomer"("email");
CREATE INDEX "B2bCustomer_vatNumber_idx" ON "B2bCustomer"("vatNumber");

-- 4. B2bRequest table ────────────────────────────────────────────────────────
CREATE TABLE "B2bRequest" (
    "id"                 TEXT NOT NULL,
    "email"              VARCHAR(255) NOT NULL,
    "status"             "B2bRequestStatus" NOT NULL DEFAULT 'PENDING',
    "companyName"        VARCHAR(255),
    "vatNumber"          VARCHAR(64),
    "modelo036Verified"  BOOLEAN NOT NULL DEFAULT false,
    "activity"           "B2bActivity",
    "activityOther"      VARCHAR(255),
    "shippingAddress"    TEXT,
    "billingAddress"     TEXT,
    "contactName"        VARCHAR(255),
    "nationalId"         VARCHAR(64),
    "phone"              VARCHAR(30),
    "website"            VARCHAR(500),
    "estimatedVolume"    VARCHAR(255),
    "preferredLanguages" VARCHAR(255),
    "notes"              TEXT,
    "reviewedAt"         TIMESTAMP(3),
    "reviewedByEmail"    VARCHAR(255),
    "rejectionReason"    TEXT,
    "customerId"         TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "B2bRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "B2bRequest_customerId_key" ON "B2bRequest"("customerId");
CREATE INDEX "B2bRequest_status_idx"    ON "B2bRequest"("status");
CREATE INDEX "B2bRequest_email_idx"     ON "B2bRequest"("email");
CREATE INDEX "B2bRequest_createdAt_idx" ON "B2bRequest"("createdAt");
ALTER TABLE "B2bRequest"
  ADD CONSTRAINT "B2bRequest_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "B2bCustomer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. B2bSession table ────────────────────────────────────────────────────────
CREATE TABLE "B2bSession" (
    "id"          TEXT NOT NULL,
    "customerId"  TEXT NOT NULL,
    "tokenHash"   VARCHAR(128) NOT NULL,
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent"   VARCHAR(500),
    "ipAddress"   VARCHAR(64),

    CONSTRAINT "B2bSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "B2bSession_tokenHash_key" ON "B2bSession"("tokenHash");
CREATE INDEX "B2bSession_customerId_idx"       ON "B2bSession"("customerId");
CREATE INDEX "B2bSession_expiresAt_idx"        ON "B2bSession"("expiresAt");
ALTER TABLE "B2bSession"
  ADD CONSTRAINT "B2bSession_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "B2bCustomer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. B2bActivationToken table ────────────────────────────────────────────────
CREATE TABLE "B2bActivationToken" (
    "id"          TEXT NOT NULL,
    "customerId"  TEXT NOT NULL,
    "tokenHash"   VARCHAR(128) NOT NULL,
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "usedAt"      TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "B2bActivationToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "B2bActivationToken_tokenHash_key" ON "B2bActivationToken"("tokenHash");
CREATE INDEX "B2bActivationToken_customerId_idx"       ON "B2bActivationToken"("customerId");
CREATE INDEX "B2bActivationToken_expiresAt_idx"        ON "B2bActivationToken"("expiresAt");
ALTER TABLE "B2bActivationToken"
  ADD CONSTRAINT "B2bActivationToken_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "B2bCustomer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. B2bLoginAudit table ─────────────────────────────────────────────────────
CREATE TABLE "B2bLoginAudit" (
    "id"          TEXT NOT NULL,
    "customerId"  TEXT,
    "email"       VARCHAR(255) NOT NULL,
    "success"     BOOLEAN NOT NULL,
    "reason"      VARCHAR(120),
    "ipAddress"   VARCHAR(64),
    "userAgent"   VARCHAR(500),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "B2bLoginAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "B2bLoginAudit_email_createdAt_idx" ON "B2bLoginAudit"("email", "createdAt");
CREATE INDEX "B2bLoginAudit_customerId_idx"      ON "B2bLoginAudit"("customerId");
CREATE INDEX "B2bLoginAudit_createdAt_idx"       ON "B2bLoginAudit"("createdAt");
ALTER TABLE "B2bLoginAudit"
  ADD CONSTRAINT "B2bLoginAudit_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "B2bCustomer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
