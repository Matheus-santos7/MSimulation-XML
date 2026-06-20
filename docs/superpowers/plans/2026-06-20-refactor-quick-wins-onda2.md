# Refatoração Quick Wins — Onda 2 Implementation Plan

> **Status:** ✅ Concluído em 2026-06-20

**Goal:** Eliminar shims de compatibilidade e aliases deprecated no backend, padronizando nomes EN sem alterar comportamento.

**Architecture:** Imports diretos de `org/`, remoção de re-exports mortos, simplificação de mapeamentos de erro HTTP.

---

## Alterações realizadas

### Shims removidos

- Deletado `emitente-emissao-override.ts` — imports migrados para `modules/org/index.js`
- Removidos `lookupRoutes` e `fiscalSettingsRoutes`

### Erros unificados

- `order.controller.ts` mapeia apenas `OrderLockedError` e `SalesChainError`
- Removidas classes `PedidoLockedError` e `VendaChainError`

### Exports deprecated removidos

| Módulo | Itens removidos |
|--------|-----------------|
| `fiscal-documents` | `DevolucaoError`, `CancelamentoError`, `InutilizacaoError`, `chaveParamSchema`, `cancelamentoBodySchema`, `inutilizarBodySchema`, `cancelarVenda`, `emitirDevolucaoVenda`, `inutilizarNumeracao` |
| `fiscal-settings` | `FiscalEmitterSettingsView`, `fiscalSettingsRoutes`, `fiscalEmitterSettingsPatchBody`, `FiscalEmitterSettingsService` |
| `sales` | `PedidoLockedError`, `VendaChainError`, `pedidoCheckoutBody`, `pedidoIdParam`, `compradorCheckoutBody` |
| `remessas` | `criarRemessaSimbolicaAvanco` |

## Verificação

```bash
pnpm test:backend
# exit 0 — 108 tests pass
```

## Próxima onda

Onda 3: extrair `UFS` para `frontend/src/lib/brazilian-states.ts`
