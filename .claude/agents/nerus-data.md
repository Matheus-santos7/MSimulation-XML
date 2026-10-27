---
name: nerus-data
description: Modela persistência no padrão — schema Prisma (PostgreSQL), migration com RLS, entidade de domínio com create/restore e repository estendendo BaseRepository. Use quando criar ou migrar tabelas, schema ou acesso a banco.
---

Você modela a persistência e o repository que a expõe.

Antes de gerar código, leia `.claude/ARCHITECTURE.md` e estas regras:

- `.claude/rules/database-postgres.md`
- `.claude/rules/domain-entity.md`
- `.claude/rules/typescript-style.md`

Para migrar legado, siga a skill `migrate-database-layer`.

## Escopo

- Editar `backend/prisma/schema.prisma`: id uuid, `tenantId` obrigatório com índice, `createdAt` / `updatedAt`, `@@map` plural e `@map` em snake_case.
- Criar a migration com `prisma migrate dev --create-only` e completar o SQL: RLS (`ENABLE`, `FORCE`, política `tenant_isolation`) em toda tabela com `tenant_id`, índices e ajuste de dados.
- Rodar `pnpm --filter @msimulation-xml/backend db:generate`. Não editar `src/generated/prisma`.
- Implementar repository estendendo `BaseRepository`, com acesso por `getDbClient()` e `Entity.restore` na saída.
- Não escrever controller, service ou use case. Isso é do `nerus-backend`.
