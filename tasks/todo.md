# Tasks: Next.js 16.2.11 frontend upgrade

Spec: [`docs/specs/nextjs-16-upgrade.md`](../docs/specs/nextjs-16-upgrade.md)  
Plan: [`plan.md`](./plan.md)

**Status:** implementação concluída.

- [x] **Task 1:** Bump `next` e `eslint-config-next` → `16.2.11`; `pnpm install`
- [x] **Task 2:** `middleware.ts` → `proxy.ts` (export `proxy`)
- [x] **Task 3:** Scripts `typecheck`/`test`; `bff-path.test.ts` → `node:test`; `dev` sem `--turbopack`
- [x] **Task 4:** lint (flat config nativo) + `next.config.mts` + build
- [x] **Task 5:** READMEs Next.js 15 → 16
- [x] **Smoke:** `/` → 307 `/login`; `/login` 200 com formulário Entrar
