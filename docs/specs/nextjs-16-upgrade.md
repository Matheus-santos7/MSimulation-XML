# Spec: Upgrade frontend Next.js 15.5.19 → 16.2.x

## Objective

Atualizar o pacote `@msimulation-xml/frontend` de **Next.js 15.5.19** para a **última 16.2.x estável no npm** (`16.2.11` em 2026-07-22), preservando App Router, auth via cookies/`middleware`→`proxy`, BFF e headers de segurança — sem features novas (React Compiler, Cache Components, PPR).

**Sucesso:** `pnpm install` limpo; typecheck; testes do frontend; `next build` do frontend.

## ASSUMPTIONS I'M MAKING

1. **Alvo exato:** `next@16.2.11` + `eslint-config-next@16.2.11` (última 16.2 estável no npm nesta data).
2. **React:** manter `react` / `react-dom` em `^19.2.0` (já compatível com peer do Next 16); só bump de patch se o install exigir.
3. **Escopo:** só `frontend/` + menções de versão em READMEs/docs. Sem mudanças de backend/packages fiscais.
4. **`middleware` → `proxy`:** migrar agora (depreciação oficial no 16). Runtime passa a ser **Node.js** (não Edge). O código atual só faz cookies + `fetch` de refresh — compatível com Node.
5. **Não habilitar** `reactCompiler`, `cacheComponents` / PPR, nem `experimental.turbopackFileSystemCacheForDev`.
6. **Turbopack:** aceitar default do Next 16 em `dev` e `build` (já usamos `--turbopack` no `dev`; não há `webpack` custom em `next.config.ts`).
7. **Scripts de verificação:** se `typecheck` / `test` não existirem no frontend, **adicionar** scripts mínimos como parte do upgrade (não como feature nova).
8. **Teste órfão:** `bff-path.test.ts` importa `vitest` sem `vitest` no `package.json` → converter para `node:test` (padrão dos outros 2 testes), não instalar Vitest.
9. **Docs:** atualizar menções “Next.js 15” → “Next.js 16” no README raiz / `frontend/README.md` no final.

→ Corrija agora ou sigo com estas assumptions após aprovação.

## Tech Stack (antes → depois)

| Item | Antes | Depois |
|------|-------|--------|
| next | 15.5.19 | 16.2.11 |
| eslint-config-next | 15.5.19 | 16.2.11 |
| react / react-dom | ^19.2.0 | ^19.2.0 (manter) |
| Node engines (Next) | — | >= 20.9.0 (local: v24.14.0 OK) |
| Router | App Router (`frontend/src/app`) | igual |
| Auth gate | `src/middleware.ts` | `src/proxy.ts` (export `proxy`) |
| Lint | `eslint` + FlatCompat | igual (já não usa `next lint`) |

## Sources (oficiais)

- Upgrade 15→16: https://nextjs.org/docs/app/guides/upgrading/version-16
- Proxy convention: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- Codemod middleware→proxy: `npx @next/codemod@canary middleware-to-proxy .`
- Codemod upgrade: `pnpm dlx @next/codemod@canary upgrade latest` (preferimos bump pinado + migração cirúrgica)

## Breaking changes que afetam ESTE repo

| Mudança (docs Next 16) | Impacto neste repo | Ação |
|------------------------|--------------------|------|
| `middleware` → `proxy` (filename + export); runtime Node, não Edge | **Alto** — existe `frontend/src/middleware.ts` com auth/2FA/refresh | Renomear para `src/proxy.ts`, `middleware` → `proxy`; manter `NextRequest`/`NextResponse` + `config.matcher` |
| Async Request APIs síncronas removidas | **Baixo** — já usamos `await cookies()`, `params`/`searchParams` como `Promise` | Auditar; codemod só se sobrar sync |
| Turbopack default em `dev`/`build` | **Baixo** — sem webpack custom; `dev` já usa turbopack | Remover `--turbopack` opcional no script `dev`; validar `next build` |
| `next lint` removido; `eslint` em next.config removido | **Nenhum** — script já é `"lint": "eslint"`; config flat | Só bump `eslint-config-next` |
| `revalidateTag(tag, profile)` | **Nenhum** — só `revalidatePath` | — |
| `next/image` defaults / localPatterns | **Nenhum** — sem `next/image` | — |
| Parallel routes exigem `default.js` | **Nenhum** — sem slots `@` | — |
| AMP / `next/legacy/image` removidos/deprecados | **Nenhum** | — |
| Node >= 20.9 | **OK** localmente; documentar se CI/deploy usar Node 18 | Verificar CI se houver |
| React 19.2 no App Router | **OK** — já em 19.2 | — |

### Fora de escopo / risco residual

- Nome `proxy.ts` (convenção Next) ≠ `lib/http/bff-proxy.ts` (BFF HTTP). Não renomear o BFF.
- Comentários/`edge-cookies.ts`: nome legado; runtime deixa de ser Edge após migração — opcional renomear depois (ask first).
- Codemod `upgrade latest` pode ir além de 16.2.x → **não** usar “latest” cego; pinar 16.2.11.

## Commands

```bash
# Install (raiz monorepo)
pnpm install

# Typecheck frontend (script a adicionar se ausente)
pnpm --filter @msimulation-xml/frontend typecheck
# equivalente: cd frontend && pnpm exec tsc --noEmit

# Test frontend (script a adicionar se ausente)
pnpm --filter @msimulation-xml/frontend test
# equivalente: node --import tsx --test src/lib/**/*.test.ts  (ou paths explícitos)

# Lint / Build
pnpm --filter @msimulation-xml/frontend lint
pnpm --filter @msimulation-xml/frontend build
```

## Project Structure (tocado)

```
frontend/package.json          → next + eslint-config-next 16.2.11; scripts typecheck/test; limpar --turbopack
frontend/pnpm-lock (raiz)      → lockfile
frontend/src/middleware.ts     → migrar para src/proxy.ts (remover middleware.ts)
frontend/eslint.config.mjs     → só se FlatCompat/API do eslint-config-next 16 exigir
frontend/next.config.ts        → só se build/Turbopack exigir ajuste (hoje: headers + outputFileTracingRoot)
frontend/src/lib/**/*.test.ts  → vitest → node:test em bff-path.test.ts
README.md / frontend/README.md → Next.js 15 → 16
```

## Code Style

- Manter imports `@/`, Server Actions, `revalidatePath`.
- Em `proxy.ts`, padrão oficial com `NextRequest` / `NextResponse` (docs proxy).
- Sem abstrações novas; sem “limpeza” ortogonal.

## Testing Strategy

- **Unit:** 3 ficheiros em `frontend/src/lib/*.test.ts` via `node:test` (+ `tsx` se necessário para TS).
- **Typecheck:** `tsc --noEmit` com `tsconfig.json` do frontend.
- **Build:** `next build` (prova App Router + proxy + config).
- **Não** exigir E2E browser nesta migração (ask first se quiser smoke auth).

## Boundaries

- **Always:** pinar versões iguais `next` / `eslint-config-next`; verificar após cada task; citar docs oficiais nas decisões de framework.
- **Ask first:** ativar React Compiler / Cache Components; renomear `edge-cookies.ts`; mudar CI/Node; upgrade para 16.3+/17; instalar Vitest.
- **Never:** alterar motor fiscal/XML; commitar secrets; silenciar falhas de typecheck/build; usar `next@latest` sem pin; manter `middleware` e `proxy` em paralelo.

## Success Criteria

- [ ] `frontend/package.json`: `next` e `eslint-config-next` = `16.2.11`
- [ ] `src/proxy.ts` existe com export `proxy`; `src/middleware.ts` removido
- [ ] `pnpm install` (raiz) OK
- [ ] `pnpm --filter @msimulation-xml/frontend typecheck` exit 0
- [ ] `pnpm --filter @msimulation-xml/frontend test` exit 0
- [ ] `pnpm --filter @msimulation-xml/frontend build` exit 0
- [ ] Docs públicas mencionam Next.js 16 (não 15)

## Open Questions

1. Confirma migração **middleware → proxy** agora (recomendado), ou preferes manter `middleware` no Edge até follow-up da Vercel?
2. OK adicionar scripts `typecheck` / `test` no `frontend/package.json`?
3. Smoke manual de login/refresh após build — desejado nesta entrega ou só CI local acima?

## Migration notes (deprecation-and-migration)

- **Tipo:** compulsory no ecossistema Next 16 para `middleware` filename (deprecado); replacement = `proxy`.
- **Padrão:** Strangler leve — uma cutover (rename + verify), sem dual-run de `middleware`+`proxy`.
- **Rollback:** reverter bump + restaurar `middleware.ts` (git).
- **Consumidores:** só o próprio frontend (matcher de rotas app/auth).
