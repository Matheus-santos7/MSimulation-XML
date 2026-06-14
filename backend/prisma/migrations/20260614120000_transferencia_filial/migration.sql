-- AlterEnum
ALTER TYPE "NFeTipo" ADD VALUE 'TRANSFERENCIA_FILIAL';
ALTER TYPE "OperacaoFiscalTipo" ADD VALUE 'TRANSFERENCIA_FILIAL';

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "serie_transferencia" INTEGER NOT NULL DEFAULT 8;

-- CreateTable
CREATE TABLE "tenant_filiais" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "razao_social" TEXT NOT NULL,
    "nome_fantasia" TEXT NOT NULL,
    "cnpj" VARCHAR(14) NOT NULL,
    "ie" TEXT NOT NULL,
    "crt" INTEGER NOT NULL DEFAULT 3,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT NOT NULL DEFAULT 'SN',
    "complemento" TEXT,
    "bairro" TEXT NOT NULL,
    "codigo_municipio" VARCHAR(7) NOT NULL,
    "municipio" TEXT NOT NULL,
    "uf" VARCHAR(2) NOT NULL,
    "cep" VARCHAR(8) NOT NULL,
    "telefone" TEXT,
    "serie_remessa" INTEGER NOT NULL,
    "unidade_logistica_padrao_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_filiais_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_filiais_tenant_id_cnpj_key" ON "tenant_filiais"("tenant_id", "cnpj");
CREATE INDEX "tenant_filiais_tenant_id_idx" ON "tenant_filiais"("tenant_id");

ALTER TABLE "tenant_filiais" ADD CONSTRAINT "tenant_filiais_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_filiais" ADD CONSTRAINT "tenant_filiais_unidade_logistica_padrao_id_fkey" FOREIGN KEY ("unidade_logistica_padrao_id") REFERENCES "meli_unidades_logisticas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS
ALTER TABLE "tenant_filiais" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_filiais" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "tenant_filiais";
CREATE POLICY tenant_isolation ON "tenant_filiais"
  FOR ALL
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
