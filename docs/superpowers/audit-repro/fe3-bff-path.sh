#!/bin/bash
# FE-3: o BFF repassa `..` para o backend? Sobe um servidor de API falso (55433) que registra o
# caminho recebido e o Next dev (3100) com API_URL apontando para ele; envia caminhos com `..`.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
LOG="${TMPDIR:-/tmp}/fe3-fake-api.log"
: > "$LOG"
node -e '
const fs = require("fs");
require("http").createServer((req, res) => {
  fs.appendFileSync(process.argv[1], req.url + "\n");
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ path: req.url }));
}).listen(55433, "127.0.0.1");
' "$LOG" &
FAKE=$!
(cd "$ROOT/frontend" && API_URL=http://127.0.0.1:55433 NEXT_PUBLIC_API_URL=http://127.0.0.1:55433 \
  npx next dev -p 3100 -H 127.0.0.1 > "${TMPDIR:-/tmp}/fe3-next.log" 2>&1) &
NEXT=$!
trap 'kill $FAKE $NEXT 2>/dev/null; pkill -f "next dev -p 3100" 2>/dev/null' EXIT
for _ in $(seq 1 90); do curl -s -o /dev/null http://127.0.0.1:3100/login && break; sleep 2; done

# JWT de teste (não assinado por ninguém; o BFF só checa o exp localmente).
B64() { printf '%s' "$1" | base64 | tr '+/' '-_' | tr -d '='; }
TOKEN="$(B64 '{"alg":"HS256","typ":"JWT"}').$(B64 "{\"sub\":\"x\",\"exp\":$(( $(date +%s) + 3600 ))}").sig"

for path in "nfes/abc/xml" "nfes/../auth/me" "nfes/%2e%2e/auth/me" "nfes/..%2fauth%2fme"; do
  code=$(curl -s --path-as-is -o /dev/null -w '%{http_code}' -H "Cookie: access_token=$TOKEN" "http://127.0.0.1:3100/api/bff/$path")
  echo "GET /api/bff/$path → HTTP $code"
done
echo "caminhos que chegaram à API falsa:"
sed 's/^/  /' "$LOG"
if grep -q "^/api/auth/me" "$LOG"; then echo "VEREDITO: Confirmado"; else echo "VEREDITO: Refutado"; fi
