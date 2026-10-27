#!/bin/bash
# Roda a suíte do backend (Vitest, *.spec.ts) depois de compilar os pacotes fiscais.
# Chamado por: pnpm test

set -e

cd "$(dirname "$0")"

echo "Building fiscal packages..."
pnpm --filter @msimulation-xml/fiscal-core build
pnpm --filter @msimulation-xml/nfe-xml build

echo "Generating Prisma client..."
pnpm exec prisma generate

echo "Running Vitest ($(find src -name '*.spec.ts' | wc -l) files)..."
pnpm exec vitest run
