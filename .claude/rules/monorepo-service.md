---
paths:
  - "backend/package.json"
  - "packages/*/package.json"
  - "pnpm-workspace.yaml"
---

# Monorepo

- pnpm workspaces: `backend` (`@msimulation-xml/backend`), `frontend` (`@msimulation-xml/frontend`), `packages/fiscal-core`, `packages/nfe-xml`.
- Um serviço de backend só. Não crie outro app de API nem comunicação HTTP interna; feature nova é módulo em `backend/src/modules/`.
- Código compartilhado entre backend e outros pacotes vai para `packages/*`, publicado no workspace (`workspace:*`). `packages/*` não depende de Nest, Fastify nem Prisma.
- Não importe arquivo de outro pacote por caminho relativo. Use o nome do pacote.
- Núcleo do backend (guards, filtros, pipes, classes base) fica em `backend/src/nest/`, não num pacote separado.
- Scripts do backend: `dev`, `build` (`prisma generate && tsc`), `start`, `test`, `lint`, `db:generate`, `db:migrate`, `db:migrate:deploy`.
- Node 24. Dependência nova entra com versão exata ou `^` igual às vizinhas, e o `pnpm-lock.yaml` vai no mesmo commit.
- CI (`.github/workflows/ci.yml`): lint, build dos pacotes, `prisma generate`, build, `tsc` dos testes, `pnpm depcheck`, `pnpm test:backend`, `pnpm audit`.
