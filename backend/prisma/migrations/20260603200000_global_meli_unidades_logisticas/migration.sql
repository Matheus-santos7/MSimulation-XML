-- Catálogo global de unidades logísticas Meli + vínculo por tenant.
-- Dedupe por CNPJ (fallback: código) e remapeia FKs antes de remover tenant_id.

-- CreateTable
CREATE TABLE "tenant_unidades_logisticas" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "unidade_id" TEXT NOT NULL,
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_unidades_logisticas_pkey" PRIMARY KEY ("id")
);

-- Mapeamento old_id -> canonical_id (vencedor = mais antigo por chave de dedupe)
CREATE TEMP TABLE "unidade_id_map" (
    "old_id" TEXT NOT NULL PRIMARY KEY,
    "canonical_id" TEXT NOT NULL
);

INSERT INTO "unidade_id_map" ("old_id", "canonical_id")
SELECT
    m."id",
    (
        SELECT m2."id"
        FROM "meli_unidades_logisticas" m2
        WHERE (
            CASE
                WHEN m."cnpj" ~ '^[0-9]{14}$' AND m."cnpj" <> '00000000000000' THEN 'cnpj:' || m."cnpj"
                ELSE 'codigo:' || m."codigo"
            END
        ) = (
            CASE
                WHEN m2."cnpj" ~ '^[0-9]{14}$' AND m2."cnpj" <> '00000000000000' THEN 'cnpj:' || m2."cnpj"
                ELSE 'codigo:' || m2."codigo"
            END
        )
        ORDER BY m2."created_at" ASC, m2."id" ASC
        LIMIT 1
    )
FROM "meli_unidades_logisticas" m;

-- Remapeia FKs para o id canônico
UPDATE "nfes" n
SET "unidade_destino_id" = map."canonical_id"
FROM "unidade_id_map" map
WHERE n."unidade_destino_id" = map."old_id"
  AND map."old_id" <> map."canonical_id";

UPDATE "nfes" n
SET "unidade_origem_id" = map."canonical_id"
FROM "unidade_id_map" map
WHERE n."unidade_origem_id" = map."old_id"
  AND map."old_id" <> map."canonical_id";

UPDATE "movimentacoes_produto" mp
SET "unidade_destino_id" = map."canonical_id"
FROM "unidade_id_map" map
WHERE mp."unidade_destino_id" = map."old_id"
  AND map."old_id" <> map."canonical_id";

UPDATE "movimentacoes_produto" mp
SET "unidade_origem_id" = map."canonical_id"
FROM "unidade_id_map" map
WHERE mp."unidade_origem_id" = map."old_id"
  AND map."old_id" <> map."canonical_id";

UPDATE "tenants" t
SET "unidade_logistica_padrao_id" = map."canonical_id"
FROM "unidade_id_map" map
WHERE t."unidade_logistica_padrao_id" = map."old_id"
  AND map."old_id" <> map."canonical_id";

-- Vínculos tenant ↔ unidade canônica (antes de apagar duplicatas do catálogo)
CREATE TEMP TABLE "unidade_tenant_links" AS
SELECT
    m."tenant_id",
    map."canonical_id",
    m."created_at",
    (
        t."unidade_logistica_padrao_id" IS NOT NULL
        AND map."canonical_id" = t."unidade_logistica_padrao_id"
    ) AS "padrao"
FROM "meli_unidades_logisticas" m
INNER JOIN "unidade_id_map" map ON map."old_id" = m."id"
INNER JOIN "tenants" t ON t."id" = m."tenant_id";

-- Remove duplicatas do catálogo (mantém vencedor)
DELETE FROM "meli_unidades_logisticas" m
USING "unidade_id_map" map
WHERE m."id" = map."old_id"
  AND map."old_id" <> map."canonical_id";

-- Resolve colisão de código entre unidades distintas que sobreviveram ao dedupe
UPDATE "meli_unidades_logisticas" m
SET "codigo" = LEFT(m."codigo", 27) || '_' || RIGHT(m."cnpj", 4)
WHERE m."id" IN (
    SELECT x."id"
    FROM (
        SELECT
            "id",
            ROW_NUMBER() OVER (PARTITION BY "codigo" ORDER BY "created_at" ASC, "id" ASC) AS rn
        FROM "meli_unidades_logisticas"
    ) x
    WHERE x.rn > 1
);

-- Popula vínculos tenant ↔ unidade (dedupe por par tenant+unidade)
INSERT INTO "tenant_unidades_logisticas" ("id", "tenant_id", "unidade_id", "padrao", "created_at", "updated_at")
SELECT
    gen_random_uuid()::text,
    src."tenant_id",
    src."canonical_id",
    src."padrao",
    src."created_at",
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT ON (l."tenant_id", l."canonical_id")
        l."tenant_id",
        l."canonical_id",
        l."padrao",
        l."created_at"
    FROM "unidade_tenant_links" l
    ORDER BY l."tenant_id", l."canonical_id", l."padrao" DESC, l."created_at" ASC
) src;

-- Garante no máximo uma unidade padrão por tenant (prioriza a já marcada)
WITH ranked AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "tenant_id"
            ORDER BY "padrao" DESC, "created_at" ASC, "id" ASC
        ) AS rn
    FROM "tenant_unidades_logisticas"
    WHERE "padrao" = true
)
UPDATE "tenant_unidades_logisticas" tul
SET "padrao" = false
FROM ranked r
WHERE tul."id" = r."id"
  AND r.rn > 1;

-- Remove coluna tenant_id do catálogo global
ALTER TABLE "meli_unidades_logisticas" DROP CONSTRAINT "meli_unidades_logisticas_tenant_id_fkey";
DROP INDEX "meli_unidades_logisticas_tenant_id_cnpj_key";
DROP INDEX "meli_unidades_logisticas_tenant_id_codigo_key";
DROP INDEX "meli_unidades_logisticas_tenant_id_ativa_idx";
ALTER TABLE "meli_unidades_logisticas" DROP COLUMN "tenant_id";

-- Remove padrão legado em tenants (agora em tenant_unidades_logisticas.padrao)
ALTER TABLE "tenants" DROP CONSTRAINT "tenants_unidade_logistica_padrao_id_fkey";
ALTER TABLE "tenants" DROP COLUMN "unidade_logistica_padrao_id";

-- Índices globais do catálogo
CREATE UNIQUE INDEX "meli_unidades_logisticas_cnpj_key" ON "meli_unidades_logisticas"("cnpj");
CREATE UNIQUE INDEX "meli_unidades_logisticas_codigo_key" ON "meli_unidades_logisticas"("codigo");
CREATE INDEX "meli_unidades_logisticas_ativa_idx" ON "meli_unidades_logisticas"("ativa");

-- Índices do vínculo tenant
CREATE UNIQUE INDEX "tenant_unidades_logisticas_tenant_id_unidade_id_key" ON "tenant_unidades_logisticas"("tenant_id", "unidade_id");
CREATE INDEX "tenant_unidades_logisticas_tenant_id_idx" ON "tenant_unidades_logisticas"("tenant_id");
CREATE UNIQUE INDEX "tenant_unidades_logisticas_one_padrao_per_tenant" ON "tenant_unidades_logisticas"("tenant_id") WHERE "padrao" = true;

-- AddForeignKey
ALTER TABLE "tenant_unidades_logisticas" ADD CONSTRAINT "tenant_unidades_logisticas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_unidades_logisticas" ADD CONSTRAINT "tenant_unidades_logisticas_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "meli_unidades_logisticas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
