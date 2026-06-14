-- Papéis de emitente fiscal: principal (remessas) e matriz (transferência interna).

ALTER TABLE "tenants"
  ADD COLUMN "emitente_fiscal_principal" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "emitente_fiscal_matriz" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "tenant_filiais"
  ADD COLUMN "serie_transferencia" INTEGER,
  ADD COLUMN "emitente_fiscal_principal" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "emitente_fiscal_matriz" BOOLEAN NOT NULL DEFAULT false;
