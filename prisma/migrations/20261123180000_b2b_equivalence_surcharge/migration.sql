-- Recargo de Equivalencia (Spanish equivalence surcharge) for B2B customers.
-- Customers/requests get a flag; orders freeze the applied rate and amount.
ALTER TABLE "B2bRequest" ADD COLUMN "equivalenceSurcharge" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "B2bCustomer" ADD COLUMN "equivalenceSurcharge" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "B2bOrder" ADD COLUMN "surchargeRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
ADD COLUMN "surchargeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
