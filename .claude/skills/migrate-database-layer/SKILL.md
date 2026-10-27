---
name: migrate-database-layer
description: Migrates a legacy persistence layer to Prisma models on PostgreSQL with Row-Level Security plus a BaseRepository that returns domain entities. Use when moving SQL, ORMs, or database access into this project's Prisma and repository pattern.
---

# Migrar a camada de banco

Siga `.claude/rules/database-postgres.md` e `.claude/rules/domain-entity.md`.

## Passos

1. Declare o modelo em `backend/prisma/schema.prisma`: `id String @id @default(uuid())`, `tenantId String @map("tenant_id")` com `@@index([tenantId])`, `createdAt`, `updatedAt @updatedAt`.
2. `@@map` da tabela no plural e `@map` das colunas em snake_case. Tamanhos de texto espelham o legado ou o layout fiscal (`@db.VarChar(n)`). Dinheiro em `Decimal @db.Decimal(p, s)`.
3. Crie a migration: `pnpm --filter @msimulation-xml/backend exec prisma migrate dev --create-only --name <nome>`.
4. Complete o `migration.sql`: RLS da tabela nova (`ENABLE` + `FORCE` + política `tenant_isolation`), índices e cópia de dados do legado, se houver.
5. `pnpm --filter @msimulation-xml/backend db:generate`.
6. Crie `src/entities/<nome>.entity.ts` com `create` e `restore`. A entidade não importa o client gerado.
7. Crie `<feature>.repository.ts` estendendo `BaseRepository<Entity>`, acessando o banco por `getDbClient()`.
8. Toda leitura passa por `Entity.restore`. `insert` grava os campos da entidade, inclusive `id` e `tenantId`.
9. Filtro de texto (`contains` + `mode: "insensitive"`, `OR`) fica no use case, não no repository genérico.
10. Seed e script fora de request rodam dentro de `runWithDbContext(prisma, { tenantId }, fn)`.

## Repository

```typescript
@Injectable()
export class BrandRepository extends BaseRepository<BrandEntity> {
  async getById(id: string, tenantId: string): Promise<BrandEntity | null> {
    const row = await getDbClient().brand.findFirst({ where: { id, tenantId } });

    return row && BrandEntity.restore(row);
  }
}
```

## Não fazer

- Query no controller ou no service.
- `PrismaClient` raiz dentro de request (fica fora da transação com RLS).
- Tabela com `tenant_id` sem política RLS.
- `Float` para dinheiro.
- Editar `src/generated/prisma` à mão.
