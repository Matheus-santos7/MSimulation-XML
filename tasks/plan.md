# Implementation Plan: Next.js 15 → 16.2.11 (frontend)

## Overview

Bump pinado do frontend para Next.js **16.2.11**, migrar `middleware` → `proxy`, alinhar ESLint, scripts de verificação e docs. Sem features novas do 16.

Spec: [`docs/specs/nextjs-16-upgrade.md`](../docs/specs/nextjs-16-upgrade.md)

## Architecture Decisions

- **Pin 16.2.11** em vez de `latest` / codemod `upgrade latest` (evita salto fora de 16.2.x).
- **Migrar para `proxy`** (runtime Node) — auth só usa cookies + `fetch`; Edge não é requisito.
- **Não** ativar React Compiler / `cacheComponents`.
- **Testes:** padronizar em `node:test`; converter o único ficheiro Vitest órfão.
- **Turbopack:** aceitar default; remover flag `--turbopack` do `dev` se redundante.

## Dependency graph

```
Bump next + eslint-config-next (lockfile)
    │
    ├── Migrar middleware → proxy
    │
    ├── Scripts typecheck + test (+ fix bff-path.test)
    │
    ├── typecheck → test → build (gates)
    │
    └── Docs Next.js 15 → 16
```

## Task List

### Phase 1: Dependencies
- [x] Task 1: Bump `next` + `eslint-config-next` para 16.2.11; `pnpm install`

### Checkpoint: Install
- [x] Lockfile resolve; sem peer errors bloqueantes

### Phase 2: Framework migration
- [x] Task 2: `middleware.ts` → `proxy.ts` (export `proxy`)
- [x] Task 3: Scripts `typecheck`/`test`; converter `bff-path.test.ts` para `node:test`; limpar script `dev`

### Checkpoint: After Tasks 2–3
- [x] typecheck + test passam

### Phase 3: Prove + docs
- [x] Task 4: `lint` + `build` frontend; corrigir só o necessário
- [x] Task 5: READMEs Next.js 15 → 16

### Checkpoint: Complete
- [x] Critérios da SPEC satisfeitos
- [x] code-review-and-quality (pós-implementação)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Proxy Node muda comportamento Edge de cookies/fetch | Med | Mesma lógica; validar build + smoke auth se aprovado |
| Turbopack build falha (plugin/webpack oculto) | Med | Erro explícito; fallback `--webpack` só se necessário (ask first) |
| FlatCompat / eslint-config-next 16 quebra lint | Low | Ajustar `eslint.config.mjs` mínimo |
| Confusão nome `proxy.ts` vs `bff-proxy.ts` | Low | Não renomear BFF; comentário curto se útil |

## Open Questions

Herdadas da SPEC (aprovação humana).
