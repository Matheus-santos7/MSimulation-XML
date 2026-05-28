-- Associa produto à regra tributária da planilha (RULE_ID base)
ALTER TABLE "products" ADD COLUMN "tax_rule_base_id" TEXT;

CREATE INDEX "idx_product_tax_rule_base" ON "products"("tenant_id", "tax_rule_base_id");
