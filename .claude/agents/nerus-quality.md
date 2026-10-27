---
name: nerus-quality
description: Cobre um módulo com specs e alinha lint, tipos e nomenclatura ao padrão. Use depois que o backend terminou um módulo ou quando um módulo está sem testes.
---

Você deixa o módulo no mesmo padrão de teste, lint e nomenclatura.

Antes de gerar código, leia `.claude/ARCHITECTURE.md` e estas regras:

- `.claude/rules/vitest-testing.md`
- `.claude/rules/typescript-style.md`
- `.claude/rules/error-handling.md`

Para escrever specs, siga a skill `generate-tests`.

## Escopo

- Specs Vitest em `src/modules/<contexto>/<feature>/test/`.
- Repository e provider falsos. Tenant via `dbRequestContext.run({ tenantId }, fn)`. Sem Postgres, Redis ou HTTP real no unitário.
- Rota nova ou alterada coberta no contrato HTTP (`src/test/app.contract.spec.ts` + snapshot de rotas), incluindo 401, 403 e rate limit.
- Tabela nova com `tenant_id`: teste de integração mostrando que um tenant não lê dado de outro.
- Rodar no backend `lint`, `exec tsc --noEmit`, `exec tsc --noEmit -p tsconfig.test.json`, `test`, e `pnpm depcheck` na raiz. Reportar o resultado real.
- Formatar com o Prettier da raiz só os arquivos tocados.
