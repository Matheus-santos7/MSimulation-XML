---
paths:
  - "**/entities/**/*.ts"
---

# Entidade

Arquivo `backend/src/entities/<nome>.entity.ts`. A classe estende `TenantIdEntity` (base com `tenantId`, criada em `src/nest/base/` com a fundação) quando a linha é de um tenant. A entidade não importa o client gerado do Prisma.

- Construtor `private` que chama `super()`.
- `static create(obj)` faz `new`, aplica default (`enabled = true` quando existir) e `Object.assign`.
- `static restore(builder: unknown)` faz `Object.assign(new Entity(), builder)`.
- Repository devolve `Entity.restore(row)`. Nunca vaze o tipo gerado do Prisma para o service.
- Enum de status fica no arquivo da entidade, string union no valor: `PENDING = "PENDING"`.
- Limite de tamanho documentado em `LENGTH_PROPS` quando o agregado valida tamanho (espelha o `@db.VarChar(n)` do schema).
- Valor monetário chega do Prisma como `Decimal`; converta na borda do repository e não use `number` para somar dinheiro.
- Relação é propriedade opcional da entidade (`products?: ProductEntity[]`), preenchida só quando o repository pede `include`.

```typescript
export class BrandEntity extends TenantIdEntity {
  name!: string;
  enabled!: boolean;

  private constructor() {
    super();
  }

  static create(obj: { name: string; enabled?: boolean }): BrandEntity {
    const entity = new BrandEntity();

    entity.enabled = true;
    Object.assign(entity, obj);

    return entity;
  }

  static restore(builder: unknown): BrandEntity {
    return Object.assign(new BrandEntity(), builder);
  }
}
```
