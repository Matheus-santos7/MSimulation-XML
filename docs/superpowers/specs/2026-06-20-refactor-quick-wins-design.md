# Refatoração Quick Wins — Design Spec

**Data:** 2026-06-20  
**Status:** Ondas 1–3 concluídas (2026-06-20)  
**Objetivo:** Reduzir complexidade superficial, eliminar aliases deprecated e duplicações, padronizando nomes em inglês sem alterar comportamento fiscal.

## Contexto

O backend já está 100% migrado para `src/modules/`. A complexidade restante concentra-se em:

- Aliases `@deprecated` (nomes PT) ainda usados em imports ativos
- Re-exports de compatibilidade (shims entre módulos)
- Constantes duplicadas no frontend (`UFS` em 3 arquivos)
- God files grandes (`remessa-fifo.ts`, `fiscal-api.ts`) — **fora deste escopo**

## Escopo aprovado: Abordagem por ondas

Três entregas independentes, cada uma com `pnpm test:backend` verde antes de merge.

### Onda 1 — Tax aliases (APROVADA)

Migrar 7 arquivos backend para nomes EN oficiais do módulo `tax` e remover aliases PT de `tax/index.ts`.

| Deprecated (PT) | Oficial (EN) |
|-----------------|--------------|
| `montarItemFiscal` | `buildFiscalItem` |
| `calcularNotaInbound` | `calculateInboundInvoice` |
| `calcularImpostosNota` | `calculateInvoiceTaxes` |
| `linhaPedidoFromProduto` | `orderLineFromProduct` |
| `inferAliqIcmsRemessa` | `inferIcmsRateForShipment` |
| `ProdutoLinhaFiscal` | `ProductFiscalLine` |
| `ResultadoNotaInbound` | `InboundInvoiceResult` |

**Arquivos:**

- `backend/src/modules/remessas/infrastructure/fiscal/remessa-service.ts`
- `backend/src/modules/remessas/infrastructure/fiscal/remessa-simbolica-fiscal.ts`
- `backend/src/modules/remessas/infrastructure/fiscal/transferencia-filial-service.ts`
- `backend/src/modules/remessas/infrastructure/fiscal/fiscal-emissor-adapter.ts`
- `backend/src/modules/sales/infrastructure/fiscal/emit-sale-note.ts`
- `backend/src/modules/sales/infrastructure/fiscal/emit-return-note.ts`
- `backend/src/modules/fiscal-documents/infrastructure/prisma/prisma-document-return.repository.ts`
- `backend/src/modules/tax/index.ts`

**Regras:**

- Zero mudança de lógica fiscal ou payloads
- `calcularImpostosNota({ linha, rule })` → `calculateInvoiceTaxes({ line, rule })`
- Atualizar referências no `README.md` se citarem nomes antigos

**Critério de sucesso:** grep por aliases PT retorna 0 ocorrências no código (exceto histórico git).

### Onda 2 — Shims e erros deprecated (CONCLUÍDA)

- Importar `EmitenteEmissaoOverride` direto de `modules/org/`; remover `emitente-emissao-override.ts`
- Remover `lookupRoutes`, `fiscalSettingsRoutes` (usar nomes oficiais)
- Unificar mapeamentos de erro: `PedidoLockedError` → `OrderLockedError`, `VendaChainError` → `SalesChainError`
- Remover exports `@deprecated` dos `index.ts` afetados (fiscal-documents, fiscal-settings, sales, lookup)
- Remover aliases PT de schemas Zod e classes de erro duplicadas

### Onda 3 — Frontend constants (CONCLUÍDA)

- Extrair `BRAZILIAN_UFS` para `frontend/src/lib/brazilian-states.ts`
- Substituir duplicações em `pedido-wizard-dialog.tsx`, `tenant-form-fields.tsx`, `regras/page.tsx`

## Fora de escopo (quick wins originais)

- Split de `fiscal-api.ts` (~787 linhas)
- Reescrita de `cte-xml.ts` (template strings → AST)

## Refatoração adicional — remessa-fifo (2026-06-20)

God file ~913 linhas dividido em módulos focados; `remessa-fifo.ts` virou barrel público:

| Arquivo | Responsabilidade |
|---------|------------------|
| `remessa-fifo.constants.ts` | Tipos NF-e FIFO, `REMESSA_DEST_SELECT` |
| `remessa-fifo.errors.ts` | `SaldoRemessaInsuficienteError` |
| `remessa-fifo.types.ts` | Tipos Prisma pick + DTOs |
| `remessa-fifo-product-ids.ts` | Where clauses, SKU realignment |
| `remessa-fifo-item-sync.ts` | Reconciliação e preparação de saldo |
| `remessa-fifo-balance-query.ts` | Consultas de saldo por CD/NF-e |
| `remessa-fifo-origin-resolver.ts` | Resolução CD origem para avanço |
| `remessa-fifo-consumption.ts` | Débito, preview, estorno FIFO |
| `remessa-fifo.ts` | Re-exports (API estável) |

Comportamento inalterado — `pnpm test:backend` 108/108 verde.

## Verificação

Após cada onda:

```bash
pnpm test:backend
```

Exit code 0 obrigatório antes de declarar a onda concluída.
