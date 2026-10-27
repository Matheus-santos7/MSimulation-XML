# MSimulation XML

Monorepo pnpm: API NestJS 11 + Fastify em `backend/`, Next.js em `frontend/`, regras fiscais em `packages/fiscal-core` e XML de NF-e/CT-e em `packages/nfe-xml`. Banco PostgreSQL (Neon) com Prisma 7 e Row-Level Security por tenant.

A arquitetura do backend segue o padrão dos Nérus Microservices (feature module, service + use case + repository, entidade `create`/`restore`, DTOs nomeados, `BusinessException`, Vitest), adaptado para PostgreSQL. O contrato para código novo está abaixo:

@.claude/ARCHITECTURE.md

Todos os módulos já seguem esse contrato (pastas por feature, DI com `@Inject`, DTOs Zod, Vitest). A seção 12 do contrato lista onde o código ainda difere dele e por quê.

## Regras por tipo de arquivo

As regras em `.claude/rules/` carregam sozinhas quando um arquivo correspondente é lido ou editado (controller, DTO, entity, repository, schema Prisma, migration, provider, spec, bootstrap). Não repita o conteúdo delas aqui.

## Subagentes

Para refatorar legado ou criar feature nova, siga esta ordem:

1. `nerus-architect`: recorta o trabalho em features, use cases e providers. Não escreve código.
2. `nerus-data`: `schema.prisma`, migration com RLS, entity e repository.
3. `nerus-backend`: módulo Nest, DTOs, service, use cases, providers.
4. `nerus-security`: revisa tenant e RLS, JWT, validação e segredos.
5. `nerus-quality`: specs e lint.

Trabalho que cruza papéis volta para o `nerus-architect` antes de seguir.

## Skills

- `refactor-feature-module`: legado → feature module.
- `migrate-database-layer`: SQL/ORM legado → Prisma (Postgres) + RLS + `BaseRepository`.
- `generate-tests`: specs no padrão do repositório.

## Comandos

Na raiz: `pnpm test:backend` · `pnpm depcheck` · `pnpm lint` (frontend).

No backend (`pnpm --filter @msimulation-xml/backend <script>`): `dev` · `build` · `test` · `lint` · `db:generate` · `db:migrate` · `db:migrate:deploy`. Tipos dos testes: `exec tsc --noEmit -p tsconfig.test.json`.

Depois de mudar `backend/prisma/schema.prisma`: crie a migration com `prisma migrate dev --create-only`, inclua a RLS da tabela nova e rode `db:generate`. Nunca edite `src/generated/prisma` à mão.

## Convenções de trabalho

- Um PR altera uma feature ou um pacote. Rota nova ou alterada atualiza o contrato HTTP (`backend/src/test/app.contract.spec.ts` e o snapshot de rotas).
- Código e nomes em inglês, exceto termos fiscais da legislação e do layout da NF-e. Mensagens de erro da API em português, porque o frontend mostra o texto ao usuário.
- Documentação e commits em português, no formato `<tipo>: <descrição>`.
