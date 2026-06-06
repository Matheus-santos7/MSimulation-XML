-- AlterTable
ALTER TABLE "nfes" ADD COLUMN     "xml_autorizado" TEXT;

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "preco_custo" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tenants" ALTER COLUMN "numero" SET DEFAULT 'SN';

-- CreateIndex
CREATE INDEX "idx_nfe_remessa_saldo" ON "nfes"("tenant_id", "product_id", "tipo", "saldo_disponivel");
