#!/bin/bash
# Roda um script de reprodução com tsx a partir do backend, sem dotenv e com DATABASE_URL local.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
SCRIPT="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
shift
cd "$ROOT/backend"
DOTENV_CONFIG_PATH=/dev/null DATABASE_URL="postgresql://audit_app:audit_app@127.0.0.1:55432/audit" \
  NODE_ENV=test npx tsx --import reflect-metadata "$SCRIPT" "$@"
