# Spec: Multi-remessa NFref no retorno + xPed por item na venda

> **STATUS: APPROVED** (2026-07-24) — decisões humanas abaixo.  
> Intent: [`docs/intent/multi-remessa-nfref-xped.md`](../intent/multi-remessa-nfref-xped.md)  
> Plan: [`tasks/plan-multi-remessa-nfref-xped.md`](../../tasks/plan-multi-remessa-nfref-xped.md)  
> Specs relacionadas: `docs/specs/sale-fulfillment-cfop-matrix.md`, `backend/docs/fiscal/regras-fulfillment-cat31.md`  
> **Governança:** sem commit/push sem autorização humana explícita.

---

## Objective

Garantir que, quando a Sales Chain (e o retorno físico) consome saldo de **duas ou mais remessas** numa nota de retorno consolidada:

1. O XML do **RETORNO_SIMBOLICO** e do **RETORNO_FISICO** listem **todas** as chaves de remessa distintas em `<ide><NFref><refNFe>…</refNFe></NFref>` (um bloco por chave).
2. A **VENDA** continue referenciando **apenas** o retorno (um `NFref`).
3. Cada `<det>` (`nItem`) da venda carregue **`xPed` = orderId do produto**; o pedido (pack) guarda o **packId** (`Pedido.pedidoMl`).
4. Na criação do pedido, **cada produto adicionado gera** um orderId (`xPed` do item).
5. A UI de detalhe da NF-e liste **N chaves** referenciadas (não só uma).

### User stories

- Como operador Full ML, emito venda de X+Y de remessas distintas e vejo no XML/UI do retorno as duas chaves.
- Como operador, ao adicionar produtos no wizard, cada linha já nasce com orderId; o packId fica no pedido; a venda XML leva `xPed` por `nItem`.

## Smoke checklist (homologação)

Pré: migration `pedido_item_x_ped` aplicada; 2 remessas com saldo (SKU X e Y).

| # | Caso | Esperado |
|---|------|----------|
| 1 | Pedido com 2 itens → wizard gera packId + 2 orderIds | DB: `pedido.pedido_ml` + 2 `pedido_itens.x_ped` distintos |
| 2 | Remessa1(X) + Remessa2(Y) → faturar | Retorno XML com **2** `<NFref>`; venda com **1** `<NFref>` do retorno |
| 3 | Mesma venda | `<xPed>` por `nItem` = orderIds dos itens |
| 4 | UI `/nfe/{chave-retorno}` | Lista **2** links de referência |
| 5 | Single remessa / 1 item | 1 NFref; 1 xPed (regressão) |

**Status smoke:** pendente (humano) — implementação A–F entregue 2026-07-24.

---

## Decisions log (confirmadas)

| # | Decisão |
|---|--------|
| 1 | Modelo **consolidado**: 1 retorno + 1 venda com vários `<det>`; **não** um par por produto |
| 2 | Multi-`NFref` no **retorno → remessas**; venda só → retorno |
| 3 | **`xPed` por `nItem`** = orderId do produto; **packId** = `Pedido.pedidoMl` |
| 4 | Ao **criar/adicionar item** no pedido, o sistema **gera** orderId (`xPed` do item) |
| 5 | Incluir **RETORNO_FISICO** nesta fatia (mesmo helper multi-ref) |
| 6 | UI detalhe NF-e: **sim**, listar N chaves |
| 7 | Sem schema N:N em `NFe`; auditoria via `NfeRemessaConsumo` + FK principal |
| 8 | Devolução posterior amarrada a xPed do det: **fora de escopo** desta fatia |
| 9 | Sem commit/push sem autorização humana |

---

## Diagnóstico atual (evidência)

| Camada | Hoje | Alvo |
|--------|------|------|
| FIFO multi-remessa | ✅ | manter |
| Retorno/venda consolidados | ✅ | manter |
| Venda NFref → retorno | ✅ | manter |
| Retorno NFref → todas remessas | ❌ 1ª linha | ✅ N chaves |
| RETORNO_FISICO multi-ref | ❌ 1:1 | ✅ N quando aplicável |
| packId (`Pedido.pedidoMl`) | ✅ existe | documentar = pack |
| orderId / `xPed` por item | ❌ | `PedidoItem.xPed` + wizard |
| UI detalhe refs | ❌ 1 chave | ✅ lista |

---

## ASSUMPTIONS (aprovadas com as decisões)

1. Pack no pedido (`pedidoMl`); orderId por linha (`PedidoItem.xPed` → XML `<xPed>`).
2. Geração automática de orderId ao adicionar produto (editável); formato `gerarPedidoMl()` (16 dígitos).
3. Fallback emissão: se item sem `xPed`, usa `pedido.pedidoMl` / `mlPackId` naquele det.
4. Chaves multi-ref: distintas de preview/consumo, ordem de primeira aparição.
5. API detalhe: `nfeReferenciaChaves: string[]` (derivado de consumos + ref principal).
6. Migration Prisma para `PedidoItem.xPed` (Ask first já autorizado pela decisão 4).

---

## Tech Stack / Commands / Structure

Idem fatias anteriores: Prisma + `nfe-xml` + `fiscal-core` + Next wizard.

```bash
pnpm --filter @msimulation-xml/nfe-xml test
pnpm --filter @msimulation-xml/fiscal-core test
pnpm --filter backend test   # ou testes alvo sales / fiscal-documents
```

## Code Style (alvo)

```ts
// Pedido = pack; item = order
Pedido.pedidoMl        // packId
PedidoItem.xPed        // orderId → <det><prod><xPed>

// ide: string | string[]
ide.NFref = refs.length === 1
  ? { refNFe: refs[0] }
  : refs.map((refNFe) => ({ refNFe }));
```

## Testing Strategy

| Nível | Caso |
|-------|------|
| Unit `ide.node` | 1 e 2+ chaves |
| Unit `venda.builder` | xPed A/B em det 1 e 2 |
| Contract sales | Remessa1+2 → retorno 2 NFref; venda 1 NFref + xPed por item |
| RETORNO_FISICO | multi-ref quando ≥2 remessas |
| UI/API | `nfeReferenciaChaves.length === 2`; wizard gera xPed ao add item |
| Regressão | single remessa / single item |

## Boundaries

- **Always:** testes antes de pedir commit; CAT 31 / MOC citados; fallback single-ref.
- **Ask first:** rename breaking de `pedidoMl`; mudar contrato de devolução.
- **Never:** commit/push sem OK; omitir NFref quando há 2+ remessas; hardcode alíquota.

## Success Criteria

1. Spec APPROVED ✅  
2. Plan aprovado pelo humano → IMPLEMENT  
3. Testes + smoke: 2 NFref no retorno; xPed por nItem; UI lista N chaves; RETORNO_FISICO coberto  
4. Commit/push só com autorização

## Out of scope

- FIFO order change  
- Devolução/insucesso por xPed do det  
- Rename DB `pedido_ml` → `pack_id` (opcional futuro)
