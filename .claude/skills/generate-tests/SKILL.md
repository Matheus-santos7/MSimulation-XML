---
name: generate-tests
description: Writes unit, contract and integration tests in the style of this NestJS + PostgreSQL backend. Use when adding specs, covering a use case, controller, repository, or when the user asks to replicate this project's test pattern.
---

# Gerar testes

Siga `.claude/rules/vitest-testing.md`. Coloque o spec em `src/modules/<feature>/test/`.

Runner: Vitest no backend inteiro (`describe`/`it`/`vi` de `vitest`, asserts com `node:assert/strict` como no resto da suíte).

## Unitário de use case

1. `describe` com o nome da classe.
2. No `beforeEach`, monte cada dependência com `vi.fn()` e `as unknown as Tipo`, na ordem do construtor.
3. Tenant: execute dentro de `dbRequestContext.run({ tenantId: "tenant-01" }, fn)`.
4. Providers externos (CNPJ, CEP, SEFAZ) devolvem `mockResolvedValue` com o DTO mínimo do fluxo.
5. Um `it` por comportamento. Nome começando por `should`.
6. Não conecte em Postgres nem em HTTP real.

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

import { dbRequestContext } from "../../../../lib/db/tenant-rls.js";
import type { BrandRepository } from "../../brand.repository.js";
import { BrandInsertUseCase } from "../../use-cases/brand-insert.usecase.js";

describe("BrandInsertUseCase", () => {
  let repository: BrandRepository;
  let useCase: BrandInsertUseCase;

  beforeEach(() => {
    repository = { insert: vi.fn().mockImplementation(async (entity) => entity) } as unknown as BrandRepository;
    useCase = new BrandInsertUseCase(repository);
  });

  it("should insert the brand for the tenant in context", async () => {
    // Arrange
    const data = { name: "Marca" };

    // Act
    const result = await dbRequestContext.run({ tenantId: "tenant-01" }, () => useCase.execute(data));

    // Assert
    expect(result).toMatchObject({ name: "Marca", tenantId: "tenant-01" });
  });
});
```

Adapte a lista do construtor ao use case real. Não deixe dependência de fora.

## Contrato HTTP

Rota nova ou alterada entra em `src/test/app.contract.spec.ts`: o app sobe com `buildApp({ prisma: fakePrisma })` e o teste fixa status e corpo (`{ error }` / `{ error, details }`), inclusive 401, 403 e rate limit. Regenere o snapshot de rotas com `UPDATE_CONTRACT_SNAPSHOT=1`.

## Integração com banco

Postgres descartável (Docker), `prisma migrate deploy` antes da suíte. Teste obrigatório para tabela nova com `tenant_id`: dados do tenant A não aparecem numa leitura feita no contexto do tenant B.

## Fora do spec

Não teste `*.module.ts` nem `index.ts`.
