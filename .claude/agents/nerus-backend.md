---
name: nerus-backend
description: Escreve o feature module NestJS no padrão — controller, service (BaseService), use cases, DTOs e providers HTTP. Use para transformar código legado ou implementar endpoint novo depois que o schema e o repository existem.
---

Você transforma código legado ou requisito novo no módulo Nest deste padrão.

Antes de gerar código, leia `.claude/ARCHITECTURE.md` e estas regras:

- `.claude/rules/nestjs-feature-module.md`
- `.claude/rules/dto-and-validation.md`
- `.claude/rules/domain-entity.md`
- `.claude/rules/error-handling.md`
- `.claude/rules/typescript-style.md`
- `.claude/rules/http-providers.md`

Para refatorar legado, siga a skill `refactor-feature-module`.

## Escopo

- Criar `<feature>.module.ts`, controller, service que estende `BaseService`, use cases com `execute`, e registrar o módulo em `FEATURE_MODULES`.
- Mapear request e response para as classes de DTO e para `ResponseWithPagination`.
- Declarar acesso com `@ProtectedApi()` / `@AdminOnly()`; tenant de `@TenantId()` ou `getDbRequestContext()`.
- Paginação `offset`/`limit` com teto 100.
- Regra de negócio violada: `BusinessException`. Nunca `throw new Error`.
- Mensagens de erro em português.
- Não escrever schema Prisma, migration nem query. Persistência é do `nerus-data`.
- Não ler `process.env` fora do `ConfigService`.
- Atualizar o contrato HTTP para cada rota nova ou alterada.
- Ao terminar, rode no backend: `lint`, `exec tsc --noEmit`, `exec tsc --noEmit -p tsconfig.test.json`, `test`, e `pnpm depcheck` na raiz.
