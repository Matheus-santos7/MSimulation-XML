# Refatoração Quick Wins — Onda 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar imports do módulo `tax` para nomes EN oficiais e remover aliases PT deprecated, sem alterar comportamento fiscal.

**Architecture:** Substituição mecânica de imports e propriedades `{ linha }` → `{ line }` em 7 arquivos backend; remoção de re-exports deprecated em `tax/index.ts`.

**Tech Stack:** TypeScript, pnpm workspaces, Node test runner

**Status:** ✅ Concluído em 2026-06-20

---

## Verificação

```bash
pnpm test:backend
# Expected: exit 0, 108+ tests pass
```

## Arquivos alterados

- `backend/src/modules/remessas/infrastructure/fiscal/remessa-service.ts`
- `backend/src/modules/remessas/infrastructure/fiscal/remessa-simbolica-fiscal.ts`
- `backend/src/modules/remessas/infrastructure/fiscal/transferencia-filial-service.ts`
- `backend/src/modules/remessas/infrastructure/fiscal/fiscal-emissor-adapter.ts`
- `backend/src/modules/sales/infrastructure/fiscal/emit-sale-note.ts`
- `backend/src/modules/sales/infrastructure/fiscal/emit-return-note.ts`
- `backend/src/modules/fiscal-documents/infrastructure/prisma/prisma-document-return.repository.ts`
- `backend/src/modules/tax/index.ts`
- `README.md` (diagrama Mermaid)

## Próxima onda

Ver `docs/superpowers/specs/2026-06-20-refactor-quick-wins-design.md` — Onda 2 (shims e erros deprecated).
