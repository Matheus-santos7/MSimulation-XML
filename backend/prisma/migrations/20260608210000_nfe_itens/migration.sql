-- Itens de NF-e (multi-produto por remessa) + vínculo FIFO por linha.

CREATE TABLE "nfe_itens" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "nfe_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "numero_item" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "valor_icms" DECIMAL(15,2) NOT NULL,
    "ncm" TEXT NOT NULL,
    "cfop" VARCHAR(4) NOT NULL,
    "saldo_disponivel" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nfe_itens_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "nfe_remessa_consumos" ADD COLUMN "nfe_item_id" TEXT;

-- Backfill: remessas existentes viram um item por NF-e.
INSERT INTO "nfe_itens" (
    "id",
    "tenant_id",
    "nfe_id",
    "product_id",
    "numero_item",
    "quantidade",
    "valor",
    "valor_icms",
    "ncm",
    "cfop",
    "saldo_disponivel",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid()::text,
    n."tenant_id",
    n."id",
    n."product_id",
    1,
    n."quantidade",
    n."valor",
    n."valor_icms",
    n."ncm",
    n."cfop",
    n."saldo_disponivel",
    n."created_at",
    n."updated_at"
FROM "nfes" n
WHERE n."product_id" IS NOT NULL
  AND n."tipo" = 'REMESSA'
  AND n."deleted_at" IS NULL;

-- Consumos legados apontam para o item único da remessa.
UPDATE "nfe_remessa_consumos" c
SET "nfe_item_id" = i."id"
FROM "nfe_itens" i
WHERE i."nfe_id" = c."remessa_nfe_id"
  AND i."numero_item" = 1
  AND c."nfe_item_id" IS NULL;

ALTER TABLE "nfe_remessa_consumos" ALTER COLUMN "nfe_item_id" SET NOT NULL;

DROP INDEX IF EXISTS "nfe_remessa_consumos_retorno_remessa_key";

CREATE UNIQUE INDEX "nfe_itens_nfe_numero_item_key" ON "nfe_itens"("nfe_id", "numero_item");
CREATE INDEX "idx_nfe_item_tenant_id" ON "nfe_itens"("tenant_id");
CREATE INDEX "idx_nfe_item_nfe_id" ON "nfe_itens"("nfe_id");
CREATE INDEX "idx_nfe_item_product_id" ON "nfe_itens"("product_id");
CREATE INDEX "idx_nfe_item_remessa_saldo" ON "nfe_itens"("tenant_id", "product_id", "saldo_disponivel");
CREATE INDEX "idx_nfe_remessa_consumo_item" ON "nfe_remessa_consumos"("nfe_item_id");
CREATE UNIQUE INDEX "nfe_remessa_consumos_retorno_item_key" ON "nfe_remessa_consumos"("retorno_nfe_id", "nfe_item_id");

ALTER TABLE "nfe_itens" ADD CONSTRAINT "nfe_itens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nfe_itens" ADD CONSTRAINT "nfe_itens_nfe_id_fkey" FOREIGN KEY ("nfe_id") REFERENCES "nfes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nfe_itens" ADD CONSTRAINT "nfe_itens_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "nfe_remessa_consumos" ADD CONSTRAINT "nfe_remessa_consumos_nfe_item_id_fkey" FOREIGN KEY ("nfe_item_id") REFERENCES "nfe_itens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "nfe_itens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "nfe_itens" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "nfe_itens";
CREATE POLICY tenant_isolation ON "nfe_itens"
  FOR ALL
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
