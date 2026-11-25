CREATE TABLE "LoyaltyPurchase" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productGross" DECIMAL(12,2) NOT NULL,
  "eligibleSpend" DECIMAL(12,2) NOT NULL,
  "shippingGross" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "LoyaltyPurchase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LoyaltyPurchase_amounts" CHECK (
    "productGross" >= 0 AND "eligibleSpend" >= 0 AND "shippingGross" >= 0
  ),
  CONSTRAINT "LoyaltyPurchase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LoyaltyPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LoyaltyPurchase_orderId_key" ON "LoyaltyPurchase"("orderId");
CREATE INDEX "LoyaltyPurchase_userId_idx" ON "LoyaltyPurchase"("userId");
ALTER TABLE "LoyaltyPurchase" ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER "LoyaltyPurchase_append_only" BEFORE UPDATE OR DELETE ON "LoyaltyPurchase"
  FOR EACH ROW EXECUTE FUNCTION prevent_loyalty_audit_mutation();
