#!/bin/bash
# Verifica as migrations de marketplaces (a partir de 20261022120000) num Postgres LOCAL descartável.
#
# Uso (na raiz do repositório):
#   POSTGRES_PORT=5433 docker compose up -d postgres
#   bash backend/scripts/verify-marketplaces-migration.sh
#
# O que faz, num banco temporário (criado e apagado aqui):
#   1. aplica as migrations anteriores e insere dados no formato atual;
#   2. aplica a migration nova e confere que os dados continuam lá, como Mercado Livre;
#   3. compara o banco com o schema.prisma (sem drift);
#   4. confere a RLS da tabela nova com um papel sem superusuário.
#
# Nunca usa o backend/.env (aponta para produção): a URL é montada só com localhost.
set -euo pipefail

CONTAINER="msimulation-xml-db"
DB_USER="${POSTGRES_USER:-msimulation}"
DB_PASSWORD="${POSTGRES_PASSWORD:-msimulation}"
DB_PORT="${POSTGRES_PORT:-5433}"
CHECK_DB="mkt_migration_check"
APP_ROLE="mkt_migration_app"
# Primeira migration do suporte a vários marketplaces: as anteriores formam o "banco atual".
NEW_MIGRATION="20261022120000_marketplaces"
TENANT_A="00000000-0000-0000-0000-00000000000a"
TENANT_B="00000000-0000-0000-0000-00000000000b"

BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${CHECK_DB}"
TMP_CONFIG="${BACKEND_DIR}/tmp-verify-migration.config.ts"
TMP_MIGRATIONS="${BACKEND_DIR}/tmp-verify-migrations"

psql_admin() { docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d postgres -tAc "$1"; }
psql_check() { docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$CHECK_DB" -tA "$@"; }
fail() { echo "FALHOU: $1" >&2; exit 1; }
pass() { echo "ok - $1"; }

cleanup() {
  rm -rf "$TMP_CONFIG" "$TMP_MIGRATIONS"
  psql_admin "DROP DATABASE IF EXISTS ${CHECK_DB} WITH (FORCE);" >/dev/null 2>&1 || true
  psql_admin "DROP ROLE IF EXISTS ${APP_ROLE};" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker inspect "$CONTAINER" >/dev/null 2>&1 || fail "container ${CONTAINER} não está rodando (POSTGRES_PORT=${DB_PORT} docker compose up -d postgres)"

prisma_local() {
  # DATABASE_URL explícita: o dotenv do prisma.config.ts não sobrescreve variável já definida.
  (cd "$BACKEND_DIR" && DATABASE_URL="$LOCAL_URL" npx prisma "$@")
}

cleanup
psql_admin "CREATE DATABASE ${CHECK_DB};" >/dev/null

# 1. Migrations anteriores ---------------------------------------------------------------
mkdir -p "$TMP_MIGRATIONS"
for dir in "$BACKEND_DIR"/prisma/migrations/*/; do
  dir="${dir%/}" # cp -r com barra final copia só o conteúdo (BSD/macOS)
  [[ "$(basename "$dir")" < "$NEW_MIGRATION" ]] || continue
  cp -r "$dir" "$TMP_MIGRATIONS/"
done
cp "$BACKEND_DIR/prisma/migrations/migration_lock.toml" "$TMP_MIGRATIONS/"
cat > "$TMP_CONFIG" <<CONFIG
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "tmp-verify-migrations" },
  datasource: { url: "${LOCAL_URL}" },
});
CONFIG
prisma_local migrate deploy --config "$TMP_CONFIG" | grep "^Datasource" || true
pass "migrations anteriores aplicadas"

psql_check <<SQL >/dev/null
INSERT INTO tenants (id, razao_social, nome_fantasia, cnpj, ie, logradouro, bairro, codigo_municipio, municipio, uf, cep, ambiente, updated_at)
VALUES ('${TENANT_A}', 'Empresa A', 'A', '11111111000111', '1', 'Rua A', 'Centro', '3550308', 'São Paulo', 'SP', '01001000', 'HOMOLOGACAO', now()),
       ('${TENANT_B}', 'Empresa B', 'B', '22222222000122', '2', 'Rua B', 'Centro', '3550308', 'São Paulo', 'SP', '01001000', 'HOMOLOGACAO', now());
INSERT INTO pedidos (id, tenant_id, pedido_ml, dest_cpf, dest_nome, dest_logradouro, dest_bairro, dest_codigo_municipio, dest_municipio, dest_uf, dest_cep, updated_at)
VALUES ('pedido-1', '${TENANT_A}', 'PACK-123', '00000000191', 'Consumidor', 'Rua C', 'Centro', '3550308', 'São Paulo', 'SP', '01001000', now());
INSERT INTO meli_unidades_logisticas (id, codigo, nome, cnpj, logradouro, municipio, uf, cep, updated_at)
VALUES ('unidade-1', 'SCCD01', 'CD SC', '03007331012077', 'Av. Papenborg', 'Governador Celso Ramos', 'SC', '88195900', now());
INSERT INTO nfes (id, tenant_id, chave, numero, serie, nat_op, cfop, ncm, dest_nome, dest_doc, dest_uf, valor, valor_icms, aliq_icms, status, emitida_em, pedido_ml, updated_at)
VALUES ('nfe-1', '${TENANT_A}', '35260611111111000111550010000000011000000011', 1, 1, 'Venda', '5102', '61091000', 'Consumidor', '00000000191', 'SP', 100, 18, 18, 'AUTORIZADA', now(), 'PACK-123', now());
SQL
pass "dados no formato antigo inseridos"

# 2. Migration nova ----------------------------------------------------------------------
prisma_local migrate deploy | grep "^Datasource" || true
pass "migrations de marketplaces aplicadas (a partir de ${NEW_MIGRATION})"

[ "$(psql_check -c "SELECT marketplace || '|' || marketplace_order_id FROM pedidos WHERE id = 'pedido-1'")" = "MERCADO_LIVRE|PACK-123" ] \
  || fail "pedido antigo não virou Mercado Livre com o id preservado"
pass "pedido antigo: MERCADO_LIVRE, marketplace_order_id preservado"

[ "$(psql_check -c "SELECT marketplace || '|' || marketplace_order_id FROM nfes WHERE id = 'nfe-1'")" = "MERCADO_LIVRE|PACK-123" ] \
  || fail "nota antiga não virou Mercado Livre com o id preservado"
pass "nota antiga: MERCADO_LIVRE, marketplace_order_id preservado"

[ "$(psql_check -c "SELECT marketplace || '|' || codigo FROM unidades_logisticas WHERE id = 'unidade-1'")" = "MERCADO_LIVRE|SCCD01" ] \
  || fail "unidade logística não foi preservada em unidades_logisticas"
[ "$(psql_check -c "SELECT count(*) FROM pg_tables WHERE tablename = 'meli_unidades_logisticas'")" = "0" ] \
  || fail "tabela antiga meli_unidades_logisticas ainda existe"
pass "meli_unidades_logisticas renomeada para unidades_logisticas com os dados"

psql_check -c "INSERT INTO unidades_logisticas (id, codigo, nome, cnpj, logradouro, municipio, uf, cep, marketplace, updated_at) VALUES ('unidade-2', 'SCCD01', 'CD Shopee', '03007331012077', 'Rua X', 'Itajaí', 'SC', '88300000', 'SHOPEE', now());" >/dev/null \
  || fail "mesmo código e CNPJ em outro marketplace foi recusado"
pass "unidades: mesmo código/CNPJ permitido em marketplaces diferentes"

if psql_check -c "INSERT INTO unidades_logisticas (id, codigo, nome, cnpj, logradouro, municipio, uf, cep, marketplace, updated_at) VALUES ('unidade-3', 'SCCD01', 'Duplicado', '11111111000111', 'Rua Y', 'Itajaí', 'SC', '88300000', 'MERCADO_LIVRE', now());" >/dev/null 2>&1; then
  fail "código repetido no mesmo marketplace foi aceito"
fi
pass "unidades: código único dentro do marketplace"

if psql_check -c "INSERT INTO unidades_logisticas (id, codigo, nome, cnpj, logradouro, municipio, uf, cep, updated_at) VALUES ('unidade-4', 'XX01', 'Sem marketplace', '22222222000122', 'Rua Z', 'Itajaí', 'SC', '88300000', now());" >/dev/null 2>&1; then
  fail "unidade sem marketplace foi aceita"
fi
pass "unidades: marketplace obrigatório"

# 3. Drift entre banco e schema.prisma ----------------------------------------------------
if ! prisma_local migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code >/dev/null; then
  prisma_local migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script >&2 || true
  fail "o banco migrado difere do schema.prisma (SQL acima)"
fi
pass "banco migrado igual ao schema.prisma"

# 4. RLS da tabela nova (superusuário ignora RLS: o teste usa um papel comum) --------------
psql_admin "CREATE ROLE ${APP_ROLE} NOLOGIN;" >/dev/null
psql_check -c "GRANT SELECT, INSERT ON marketplace_billing_settings TO ${APP_ROLE};" >/dev/null
psql_check -c "INSERT INTO marketplace_billing_settings (id, tenant_id, marketplace, updated_at) VALUES ('mbs-b', '${TENANT_B}', 'SHOPEE', now());" >/dev/null

visible="$(psql_check <<SQL
BEGIN;
SET LOCAL ROLE ${APP_ROLE};
SELECT set_config('app.tenant_id', '${TENANT_A}', true);
INSERT INTO marketplace_billing_settings (id, tenant_id, marketplace, updated_at) VALUES ('mbs-a', '${TENANT_A}', 'SHOPEE', now());
SELECT string_agg(id, ',') FROM marketplace_billing_settings;
COMMIT;
SQL
)"
echo "$visible" | grep -qx "mbs-a" || fail "tenant A enxerga linhas de outro tenant (visível: ${visible//$'\n'/ })"
pass "RLS: tenant A só enxerga a própria configuração"

if psql_check >/dev/null 2>&1 <<SQL
BEGIN;
SET LOCAL ROLE ${APP_ROLE};
SELECT set_config('app.tenant_id', '${TENANT_A}', true);
INSERT INTO marketplace_billing_settings (id, tenant_id, marketplace, updated_at) VALUES ('mbs-x', '${TENANT_B}', 'AMAZON', now());
COMMIT;
SQL
then
  fail "tenant A conseguiu gravar configuração do tenant B"
fi
pass "RLS: tenant A não grava configuração de outro tenant"

echo "Migração verificada."
