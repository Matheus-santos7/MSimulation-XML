#!/bin/bash
# Derruba o Postgres descartável da verificação da auditoria.
docker rm -f audit-pg >/dev/null 2>&1 && echo "audit-pg removido" || echo "audit-pg não existia"
