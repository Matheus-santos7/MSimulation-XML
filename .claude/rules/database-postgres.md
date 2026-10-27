---
paths:
  - "**/*.prisma"
  - "**/prisma/migrations/**/*.sql"
  - "**/*.repository.ts"
---

# Banco (PostgreSQL + Prisma 7)

Fonte do schema: `backend/prisma/schema.prisma` (`provider = "postgresql"`). Não há ZenStack. O client é gerado em `backend/src/generated/prisma` e não se edita à mão.

- Id `String @id @default(uuid())`. Sequencial (`Int @id @default(autoincrement())`) só quando o negócio exige número.
- Tabela `@@map("plural_snake")` (`products`, `tenant_filiais`). Coluna composta `@map("snake_case")` (`tenant_id`, `created_at`).
- `createdAt DateTime @default(now()) @map("created_at")` e `updatedAt DateTime @updatedAt @map("updated_at")`.
- Tabela de negócio tem `tenantId String @map("tenant_id")`, obrigatório, com `@@index([tenantId])` e relação com `Tenant`.
- Dinheiro e alíquota: `Decimal @db.Decimal(p, s)`, nunca `Float`. Campo de layout fiscal com tamanho fixo: `@db.VarChar(n)`.
- Fluxo: editar o schema → `prisma migrate dev --create-only --name <nome>` → revisar o SQL → `db:generate`. Produção aplica com `db:migrate:deploy`.

Toda tabela nova com `tenant_id` liga a RLS na mesma migration:

```sql
ALTER TABLE "brands" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brands" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "brands";
CREATE POLICY tenant_isolation ON "brands" FOR ALL
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
```

Tabelas de autenticação (`users`, sessões, tokens) ficam fora da RLS.

Repository:

- Acessa o banco por `getDbClient()` (`lib/db/tenant-rls.ts`): é a transação aberta pelo `DbContextInterceptor`, com `app.tenant_id` aplicado. Não use o `PrismaClient` raiz dentro de request, porque ele fica fora da transação.
- Filtra por `tenantId` mesmo com RLS (defesa em profundidade).
- Devolve `Entity.restore(row)`. O tipo gerado do Prisma não sai do repository.
- Busca textual com `contains` + `mode: "insensitive"`.
- Código fora de request (script, seed, job) abre o contexto com `runWithDbContext(prisma, { tenantId }, fn)`.

```typescript
@Injectable()
export class BrandRepository extends BaseRepository<BrandEntity> {
  async insert(entity: BrandEntity): Promise<BrandEntity> {
    const row = await getDbClient().brand.create({
      data: { id: entity.id, tenantId: entity.tenantId, name: entity.name },
    });

    return BrandEntity.restore(row);
  }
}
```

`list` repassa para `super.list`. Filtro dinâmico é montado no use case como objeto novo e passado no `where`.
