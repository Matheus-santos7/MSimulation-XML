# Refatoração Quick Wins — Onda 3 Implementation Plan

> **Status:** ✅ Concluído em 2026-06-20

**Goal:** Centralizar lista de UFs brasileiras num único módulo frontend.

**Architecture:** Constante `BRAZILIAN_UFS` + tipo `BrazilianUf` em `lib/brazilian-states.ts`; consumidores importam de lá.

---

## Alterações

- Criado `frontend/src/lib/brazilian-states.ts`
- Atualizados:
  - `frontend/src/components/pedido-wizard-dialog.tsx`
  - `frontend/src/components/tenant-form-fields.tsx`
  - `frontend/src/app/(app)/regras/page.tsx`

## Verificação

```bash
pnpm lint   # exit 0 (warnings pré-existentes)
grep -r "const UFS" frontend/src  # 0 matches
```

## Quick wins — encerrado

Ondas 1–3 completas. Próximos hotspots (fora de escopo): `remessa-fifo.ts`, `fiscal-api.ts`, `cte-xml.ts`.
