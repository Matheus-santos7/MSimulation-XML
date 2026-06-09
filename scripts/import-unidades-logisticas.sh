#!/usr/bin/env bash
# Importa planilha Meli Full de unidades logísticas via API local.
#
# Uso:
#   API_EMAIL=seu@email.com API_PASSWORD=sua-senha ./scripts/import-unidades-logisticas.sh
#   API_EMAIL=... API_PASSWORD=... ./scripts/import-unidades-logisticas.sh /caminho/planilha.xlsx
#
# Variáveis opcionais:
#   API_URL     — base da API (padrão: http://localhost:3001/api)
#   ACCESS_TOKEN — pula login se já tiver um JWT válido
#   ENRICH_CEP  — true|false (padrão: true; consulta bairro/município pelo CEP)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="${API_URL:-http://localhost:3001/api}"
ENRICH_CEP="${ENRICH_CEP:-true}"

if [[ -n "${1:-}" ]]; then
  FILE="$1"
else
  FILE="$(find "$ROOT" -maxdepth 1 -iname '*unidades*logistic*.xlsx' -print -quit 2>/dev/null || true)"
  if [[ -z "$FILE" ]]; then
    echo "Erro: planilha não encontrada na raiz do projeto (*unidades*logistic*.xlsx)" >&2
    exit 1
  fi
fi

if [[ ! -f "$FILE" ]]; then
  echo "Erro: arquivo não encontrado: $FILE" >&2
  exit 1
fi

if ! command -v curl >/dev/null; then
  echo "Erro: curl não encontrado" >&2
  exit 1
fi

if ! command -v jq >/dev/null; then
  echo "Erro: jq não encontrado (brew install jq)" >&2
  exit 1
fi

TOKEN="${ACCESS_TOKEN:-}"

if [[ -z "$TOKEN" ]]; then
  EMAIL="${API_EMAIL:-}"
  PASSWORD="${API_PASSWORD:-}"
  if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
    echo "Erro: defina API_EMAIL e API_PASSWORD, ou ACCESS_TOKEN" >&2
    exit 1
  fi

  LOGIN_JSON="$(curl -sS -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"

  if echo "$LOGIN_JSON" | jq -e '.requiresTwoFactor == true' >/dev/null 2>&1; then
    echo "Erro: conta com 2FA ativo — use ACCESS_TOKEN de uma sessão já autenticada" >&2
    exit 1
  fi

  TOKEN="$(echo "$LOGIN_JSON" | jq -r '.accessToken // empty')"
  if [[ -z "$TOKEN" ]]; then
    echo "Erro no login:" >&2
    echo "$LOGIN_JSON" | jq . >&2
    exit 1
  fi
fi

echo "→ Arquivo: $FILE"
echo "→ POST $API_URL/unidades-logisticas/bulk-import (enrichCep=$ENRICH_CEP)"
echo

RESPONSE="$(curl -sS -w "\n%{http_code}" -X POST "$API_URL/unidades-logisticas/bulk-import" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@${FILE};type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" \
  -F "enrichCep=${ENRICH_CEP}")"

HTTP_CODE="$(echo "$RESPONSE" | tail -n1)"
BODY="$(echo "$RESPONSE" | sed '$d')"

echo "$BODY" | jq .

if [[ "$HTTP_CODE" -ge 400 ]]; then
  echo "Erro HTTP $HTTP_CODE" >&2
  exit 1
fi

echo
echo "Importação concluída (HTTP $HTTP_CODE)."
