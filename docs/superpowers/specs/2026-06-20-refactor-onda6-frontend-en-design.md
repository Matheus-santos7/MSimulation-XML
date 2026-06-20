# Onda 6 — Frontend EN + Forms — Design Spec

**Data:** 2026-06-20  
**Status:** Concluída  
**Objetivo:** Padronizar exports EN em `fiscal-api`, extrair lógica de formulários/páginas grandes para hooks e módulos `lib/`, mantendo thin client (zero lógica fiscal no browser).

## Escopo

### A — Renomear exports PT em `fiscal-api`

Alinhamento com backend Onda 4 onde aplicável. Rotas HTTP inalteradas.

| PT (remover) | EN (oficial) | Módulo |
|--------------|--------------|--------|
| `emitirRemessaManual` | `emitManualShipment` | logistics |
| `emitirAvancoCd` | `emitWarehouseAdvance` | logistics |
| `listSaldoRemessaPorCd` | `listRemessaBalanceByCd` | logistics |
| `listUnidadesLogisticas` | `listLogisticUnits` | logistics |
| `importUnidadesLogisticasSpreadsheet` | `importLogisticUnitsSpreadsheet` | logistics |
| `setUnidadeLogisticaPadrao` | `setDefaultLogisticUnit` | logistics |
| `emitirTransferenciaFilial` | `emitBranchTransfer` | movements |
| `listMovimentacoesProduto` | `listProductMovements` | movements |
| `listFiliais` | `listBranches` | branches |
| `createFilial` | `createBranch` | branches |
| `updateFilial` | `updateBranch` | branches |
| `deleteFilial` | `deleteBranch` | branches |
| `updatePapeisFiscais` | `updateFiscalRoles` | branches |
| `checkoutPedido` | `checkoutOrder` | products |
| `listPedidos` | `listOrders` | products |
| `createPedido` | `createOrder` | products |
| `updatePedido` | `updateOrder` | products |
| `faturarPedido` | `invoiceOrder` | products |
| `deletePedido` | `deleteOrder` | products |
| `emitirDevolucao` | `emitReturnNote` | nfes |
| `cancelarVenda` | `cancelSale` | nfes |
| `inutilizarNumeracao` | `invalidateNumbering` | nfes |

Tipos DTO exportados (`UnidadeLogisticaDto`, etc.) permanecem — espelham payload da API.

Sem barrels `@deprecated` PT: monorepo frontend atualiza call sites na mesma onda.

### B — Extrair lógica de forms/páginas

| Origem | Destino | Tipo |
|--------|---------|------|
| `regras/page.tsx` (~230 linhas helpers) | `lib/tax-rules-sheet.ts` | constants + pure utils |
| `pedido-wizard-dialog.tsx` | `hooks/use-pedido-wizard.ts` | client hook |
| `filial-form.tsx` | `hooks/use-filial-form.ts` | client hook |
| `tenant-form-fields.tsx` | `hooks/use-tenant-form-fields.ts` | client hook |

Server actions e labels UI em PT permanecem.

## Fora de escopo

- Renomear server actions (`*Action`)
- Renomear tipos DTO / rotas HTTP
- Lógica fiscal no browser

## Verificação

```bash
pnpm build
pnpm test:backend
```

Exit code 0 obrigatório.
