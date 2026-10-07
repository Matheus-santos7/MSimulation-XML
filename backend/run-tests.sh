#!/bin/bash
# Script para rodar todos os testes .test.ts com glob pattern
# Chamado por: pnpm test

set -e

cd "$(dirname "$0")"

echo "Building fiscal packages..."
pnpm --filter @msimulation-xml/fiscal-core build
pnpm --filter @msimulation-xml/nfe-xml build

echo "Generating Prisma client..."
pnpm exec prisma generate

echo "Running tests ($(find src -name '*.test.ts' | wc -l) files)..."
pnpm exec node --import tsx --test $(find src -name '*.test.ts' | sort)
