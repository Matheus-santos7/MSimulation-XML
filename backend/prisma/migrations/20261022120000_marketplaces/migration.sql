-- Suporte a vários marketplaces (Mercado Livre, Shopee, Amazon, Magalu).
-- Plano: tasks/plan-marketplaces-feature-modules.md, fase 2.
--
-- Tudo que já existe é do Mercado Livre: as colunas novas nascem com esse default.
-- Renomeações usam ALTER ... RENAME (dados, FKs e políticas são preservados).

-- Enum ----------------------------------------------------------------------
CREATE TYPE "Marketplace" AS ENUM ('MERCADO_LIVRE', 'SHOPEE', 'AMAZON', 'MAGALU');

-- Pedidos -------------------------------------------------------------------
ALTER TABLE "pedidos" ADD COLUMN "marketplace" "Marketplace" NOT NULL DEFAULT 'MERCADO_LIVRE';
ALTER TABLE "pedidos" RENAME COLUMN "pedido_ml" TO "marketplace_order_id";
CREATE INDEX "idx_pedido_tenant_marketplace" ON "pedidos"("tenant_id", "marketplace");

-- Notas fiscais -------------------------------------------------------------
ALTER TABLE "nfes" ADD COLUMN "marketplace" "Marketplace" NOT NULL DEFAULT 'MERCADO_LIVRE';
ALTER TABLE "nfes" RENAME COLUMN "pedido_ml" TO "marketplace_order_id";
CREATE INDEX "idx_nfe_tenant_marketplace" ON "nfes"("tenant_id", "marketplace");

-- Unidades logísticas: catálogo deixa de ser só do ML ------------------------
ALTER TABLE "meli_unidades_logisticas" RENAME TO "unidades_logisticas";
ALTER TABLE "unidades_logisticas" RENAME CONSTRAINT "meli_unidades_logisticas_pkey" TO "unidades_logisticas_pkey";
ALTER INDEX "meli_unidades_logisticas_cnpj_key" RENAME TO "unidades_logisticas_cnpj_key";
ALTER INDEX "meli_unidades_logisticas_codigo_key" RENAME TO "unidades_logisticas_codigo_key";
ALTER INDEX "meli_unidades_logisticas_ativa_idx" RENAME TO "unidades_logisticas_ativa_idx";
ALTER TABLE "unidades_logisticas" ADD COLUMN "marketplace" "Marketplace" NOT NULL DEFAULT 'MERCADO_LIVRE';
CREATE INDEX "unidades_logisticas_marketplace_idx" ON "unidades_logisticas"("marketplace");

-- Configuração do faturador por marketplace ---------------------------------
CREATE TABLE "marketplace_billing_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "marketplace" "Marketplace" NOT NULL,
    "overrides" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_billing_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketplace_billing_settings_tenant_id_marketplace_key"
    ON "marketplace_billing_settings"("tenant_id", "marketplace");
CREATE INDEX "marketplace_billing_settings_tenant_id_idx" ON "marketplace_billing_settings"("tenant_id");

ALTER TABLE "marketplace_billing_settings"
    ADD CONSTRAINT "marketplace_billing_settings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security: mesma política das demais tabelas de negócio.
ALTER TABLE "marketplace_billing_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketplace_billing_settings" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "marketplace_billing_settings";
CREATE POLICY tenant_isolation ON "marketplace_billing_settings" FOR ALL
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
