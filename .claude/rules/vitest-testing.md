---
paths:
  - "**/*.spec.ts"
  - "**/*.test.ts"
  - "**/vitest.config*.mjs"
---

# Testes

Vitest (oxc com decorators legados, `globals: false`, `environment: "node"`), via `backend/run-tests.sh`. Não há mais `node:test` no backend; os pacotes `fiscal-core` e `nfe-xml` continuam no `node:test` deles.

- Unitário em `src/modules/<feature>/test/**/*.spec.ts`, espelhando a pasta testada (`test/use-cases/`, `test/dtos/`).
- Não suba Postgres no unitário. Repository e provider são `vi.fn()` com `as unknown as Tipo`.
- Tenant no contexto: rode o código testado dentro de `dbRequestContext.run({ tenantId: "tenant-01" }, fn)` ou injete o leitor de contexto como dependência.
- Teste de integração com banco usa Postgres descartável (Docker), aplica todas as migrations (RLS incluída) e verifica que um tenant não lê linha de outro.
- Rota nova ou alterada: atualize `src/test/app.contract.spec.ts` e o snapshot `src/test/app.contract.routes.txt` (`UPDATE_CONTRACT_SNAPSHOT=1`).
- Instancie o use case no `beforeEach` com as dependências na ordem do construtor. `Test.createTestingModule` quando o teste precisa do container Nest.
- Nome do `describe` é a classe. Nome do `it` descreve o comportamento (`should create the order for the tenant in context`).
- Estrutura Arrange / Act / Assert.
- Cobertura mínima de 80% em código novo. Exclua `*.module.ts`, `index.ts` e os próprios specs.
- Import do spec: test runner primeiro, pacotes externos, depois relativos para a classe testada.
