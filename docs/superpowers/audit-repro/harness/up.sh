#!/bin/bash
# Sobe um Postgres descartável (contêiner audit-pg, porta 55432), aplica todas as migrations do
# backend e cria o papel audit_app (sem superusuário, NOBYPASSRLS, não é dono das tabelas).
# Nunca usa backend/.env: a URL é montada só com 127.0.0.1:55432 e o dotenv é desligado.
set -euo pipefail

CONTAINER="audit-pg"
PORT=55432
OWNER_URL="postgresql://audit:audit@127.0.0.1:${PORT}/audit"
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
BACKEND="$ROOT/backend"
TMP_CONFIG="$BACKEND/tmp-audit-repro.config.ts"

[[ "$OWNER_URL" == *"127.0.0.1:${PORT}"* ]] || { echo "URL não local, abortando" >&2; exit 1; }

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" -e POSTGRES_USER=audit -e POSTGRES_PASSWORD=audit \
  -e POSTGRES_DB=audit -p "127.0.0.1:${PORT}:5432" postgres:16 >/dev/null
until docker exec "$CONTAINER" pg_isready -U audit -d audit >/dev/null 2>&1; do sleep 1; done
sleep 1

trap 'rm -f "$TMP_CONFIG"' EXIT
cat > "$TMP_CONFIG" <<CONFIG
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: "${OWNER_URL}" },
});
CONFIG
(cd "$BACKEND" && DOTENV_CONFIG_PATH=/dev/null DATABASE_URL="$OWNER_URL" \
  npx prisma migrate deploy --config "$TMP_CONFIG" | tail -2)

docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U audit -d audit >/dev/null <<'SQL'
CREATE ROLE audit_app LOGIN PASSWORD 'audit_app' NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO audit_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO audit_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO audit_app;
SQL
echo "audit-pg pronto em ${OWNER_URL%%@*}@127.0.0.1:${PORT}"
