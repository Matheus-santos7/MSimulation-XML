-- Inutilização de numeração NF-e (procInutNFe)
CREATE TABLE "nfe_inutilizacoes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "serie" INTEGER NOT NULL,
    "numero_ini" INTEGER NOT NULL,
    "numero_fim" INTEGER NOT NULL,
    "x_just" TEXT NOT NULL,
    "protocolo" TEXT NOT NULL,
    "ocorrido_em" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nfe_inutilizacoes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_nfe_inutilizacao_tenant" ON "nfe_inutilizacoes"("tenant_id");
CREATE INDEX "idx_nfe_inutilizacao_tenant_serie" ON "nfe_inutilizacoes"("tenant_id", "serie");

ALTER TABLE "nfe_inutilizacoes" ADD CONSTRAINT "nfe_inutilizacoes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fiscal_events" ADD COLUMN "x_just" TEXT;
