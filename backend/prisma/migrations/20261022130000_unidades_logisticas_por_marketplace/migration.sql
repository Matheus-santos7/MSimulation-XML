-- Unidades logísticas por marketplace: código e CNPJ deixam de ser únicos no catálogo inteiro
-- e passam a ser únicos dentro de cada marketplace (CDs de marketplaces diferentes podem
-- repetir código). Toda unidade nova declara o marketplace (sem default).

DROP INDEX "unidades_logisticas_codigo_key";
DROP INDEX "unidades_logisticas_cnpj_key";

CREATE UNIQUE INDEX "unidades_logisticas_marketplace_codigo_key"
    ON "unidades_logisticas"("marketplace", "codigo");
CREATE UNIQUE INDEX "unidades_logisticas_marketplace_cnpj_key"
    ON "unidades_logisticas"("marketplace", "cnpj");

ALTER TABLE "unidades_logisticas" ALTER COLUMN "marketplace" DROP DEFAULT;
