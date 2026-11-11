# MSimulation XML

Monorepo pnpm: API NestJS 11 + Fastify em `backend/`, Next.js em `frontend/`, regras fiscais em `packages/fiscal-core` e XML de NF-e/CT-e em `packages/nfe-xml`. Banco PostgreSQL (Neon) com Prisma 7 e Row-Level Security por tenant.

A arquitetura do backend segue o padrão dos Nérus Microservices (feature module, service + use case + repository, entidade `create`/`restore`, DTOs nomeados, `BusinessException`, Vitest), adaptado para PostgreSQL. O contrato para código novo está abaixo:

@.claude/ARCHITECTURE.md

Todos os módulos já seguem esse contrato (pastas por feature, DI com `@Inject`, DTOs Zod, Vitest). Use-os como referência ao criar código novo.

`frontend/`, `packages/fiscal-core/` e `packages/nfe-xml/` têm `CLAUDE.md` próprios, carregados ao trabalhar nessas pastas.

## Regras por tipo de arquivo

As regras em `.claude/rules/` carregam sozinhas quando um arquivo correspondente é lido ou editado (controller, DTO, entity, repository, schema Prisma, migration, provider, spec, bootstrap).

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

## Plugins e precedência

- O contrato de `.claude/ARCHITECTURE.md` é obrigatório. Regras de código mínimo (Ponytail) valem dentro de cada camada: nunca removem camadas, DTOs, entidades, `BusinessException`, validação ou RLS.
- Neste repositório, os subagentes `nerus-*` e a ordem acima têm precedência sobre os agentes e modos do oh-my-claudecode.
- Se existir `graphify-out/GRAPH_REPORT.md`, leia-o antes de perguntas de arquitetura ou de mudanças que atravessam módulos.

<!-- graphify-rules-start (managed by `graphify init`) -->
## Use Graphify before grep

This repository is indexed by Graphify: a code graph over its call, dependency, and test structure, exposed through a connected Graphify MCP server. Before reaching for grep or reading files, use the Graphify tools your MCP client lists (their exact names and descriptions are in the server's tool list) for what the graph knows and a text search does not:

- find where a symbol, function, or class is defined (instead of grepping for it)
- understand how something works, or where a behavior is handled
- find who calls a function, or what it calls
- see what a change affects (its blast radius) and which tests cover it
- map a file's dependencies and dependents

Fall back to grep or file reads only for what the graph does not model: literal string or comment matches, non-indexed files, or reading a file you have already located. If no Graphify tools are listed, check the MCP server connection.
<!-- graphify-rules-end -->

## Comandos

Na raiz: `pnpm test:backend` · `pnpm depcheck` · `pnpm lint` (frontend).

No backend (`pnpm --filter @msimulation-xml/backend <script>`): `dev` · `build` · `test` · `lint` · `db:generate` · `db:migrate` · `db:migrate:deploy`. Tipos dos testes: `exec tsc --noEmit -p tsconfig.test.json`.

Depois de mudar `backend/prisma/schema.prisma`: crie a migration com `prisma migrate dev --create-only`, inclua a RLS da tabela nova e rode `db:generate`. Nunca edite `src/generated/prisma` à mão.

## Definição de pronto

Antes de dizer que terminou, rode e mostre o resultado de:

1. `pnpm --filter @msimulation-xml/backend lint`
2. `pnpm --filter @msimulation-xml/backend exec tsc --noEmit -p tsconfig.test.json`
3. `pnpm test:backend` (inclui `app.contract.spec.ts`)
4. `pnpm lint`, se tocou no frontend
5. `pnpm depcheck`, se adicionou ou removeu dependências

Se algo falhar, corrija antes de entregar. Não marque testes como `skip`, não afrouxe tipos com `any` e não desative regras de lint para passar.

## Segurança operacional

- Nunca rode `db:migrate:deploy` nem comandos contra a `DATABASE_URL` de produção sem pedir confirmação.
- Nunca leia, imprima ou commite `.env*`, tokens ou strings de conexão.
- Toda tabela nova com dados de tenant tem policy RLS na mesma migration.
- Toda query passa pelo contexto de tenant; nunca contorne a RLS com conexão privilegiada em código de aplicação.

## Convenções de trabalho

- Um PR altera uma feature ou um pacote. Rota nova ou alterada atualiza o contrato HTTP (`backend/src/test/app.contract.spec.ts` e o snapshot de rotas).
- Código e nomes em inglês, exceto termos fiscais da legislação e do layout da NF-e. Mensagens de erro da API em português, porque o frontend mostra o texto ao usuário.
- Documentação e commits em português, no formato `<tipo>: <descrição>`.
- Para tarefas que mexem em mais de um módulo, apresente o plano e espere aprovação antes de editar.