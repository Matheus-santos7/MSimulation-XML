# Implementation Plan: Multi-remessa NFref + xPed por nItem

> Spec: [`docs/specs/multi-remessa-nfref-xped.md`](../docs/specs/multi-remessa-nfref-xped.md) **APPROVED**  
> Todo: [`tasks/todo.md`](./todo.md)  
> **Gate:** IMPLEMENT só após OK humano neste plan. Sem commit/push sem autorização.

## Overview

Fechar o gap fiscal/operacional: retorno (simbólico **e** físico) com **N** `<NFref>` das remessas consumidas; venda com 1 ref do retorno e **`xPed` por `<det>`**; pedido com packId + orderId gerado por produto; UI detalhe listando N chaves.

## Architecture decisions

| Tema | Decisão |
|------|---------|
| Modelo ML | `Pedido.pedidoMl` = **packId**; `PedidoItem.xPed` = **orderId** → XML `<xPed>` |
| Geração | Ao adicionar item no wizard (e na API se omitido), gerar via `gerarPedidoMl()` |
| Multi-ref XML | `nfeReferenciaChave: string \| string[]` + `ide.NFref` objeto ou array |
| Persistência NFe | FK `nfeReferenciaId` = 1ª remessa; lista completa via `NfeRemessaConsumo` |
| API detalhe | `nfeReferenciaChaves: string[]` derivado (consumos ∪ ref principal) |
| Escopo tipos | `RETORNO_SIMBOLICO` (sales) + `RETORNO_FISICO` (mesmo helper) |

## Dependency graph

```
A. nfe-xml: normalize refs + ide multi-NFref + venda xPed por det
    │
B. Prisma: PedidoItem.xPed (+ migration)
    │
C. Domain/API/wizard: pack + orderId por item (gerar ao add)
    │
D. emit-return-note + RETORNO_FISICO: coletar chaves distintas → XML
    │
E. emit-sale-note: xPed por item no payload/itens
    │
F. mapNfe / detalhe UI: nfeReferenciaChaves[]
    │
G. Testes + smoke homologação
```

## Risks

| Risco | Mitigação |
|-------|-----------|
| Serialização XML de `NFref[]` | Teste unitário asserta 2 blocos `<NFref>` |
| RETORNO_FISICO hoje 1:1 | Infra multi-ref sempre; se 1 remessa, 1 NFref; se path multi existir, N |
| UI quebra com tipo `string \| string[]` | Normalizar sempre para array no DTO |
| Itens antigos sem xPed | Fallback `pedidoMl` no det |

## Phases / Tasks

### Phase 1 — Fundação XML (Task A)

**Task A: Multi-NFref + xPed por det no `nfe-xml`**  
- Aceitar `nfeReferenciaChave?: string | string[]`  
- `ide.node.ts`: emitir 1 ou N `NFref`  
- `venda.builder.ts`: `xPed` em **cada** det que tiver valor (não só `i===0`)  
- Testes: 2 refs; 2 xPed  

**Verify:** `pnpm --filter @msimulation-xml/nfe-xml test`  
**Deps:** None. **Files:** `types.ts`, `ide.node.ts`, `venda.builder.ts`, testes.

### Phase 2 — Dados do pedido (Tasks B–C)

**Task B: Migration `PedidoItem.xPed`**  
- Coluna `x_ped` nullable string  
- Prisma client regenerate  

**Verify:** migrate status / generate.  
**Deps:** A (pode paralelo com A). **Files:** `schema.prisma`, migration SQL.

**Task C: API + domain + wizard**  
- `orderItemBody.xPed` opcional; se ausente no create, backend gera `gerarPedidoMl()`  
- Frontend: ao adicionar linha, gera orderId; campo editável por card  
- Campo pack (`pedidoMl`) no wizard se ainda não houver UI clara  
- `OrderItemForEmit.xPed` + mapper  

**Verify:** create pedido 2 itens → 2 `xPed` distintos no DB.  
**Deps:** B. **Files:** `order.schemas.ts`, entity, mapper, `pedido-wizard-*`, `pedido-form-types.ts`.

### Phase 3 — Emissão (Tasks D–E)

**Task D: Retorno simbólico + físico multi-ref**  
- Helper `distinctRemessaChaves(...)`  
- `persistConsolidatedReturnXml` / emit: passar `string[]`  
- `RETORNO_FISICO` (`prisma-document-return`, inbound conference se emitir físico): mesma normalização  
- FK principal permanece 1ª remessa  

**Verify:** teste contrato Remessa1+2 → XML com 2 `refNFe`.  
**Deps:** A. **Files:** `emit-return-note.ts`, return repos, poss. shared persist helper.

**Task E: Venda com xPed por item**  
- `emit-sale-note`: por item `xPed = item.xPed ?? pack`  
- Garantir builder recebe xPed em cada linha do engine/payload  

**Verify:** XML venda com 2 `<xPed>` distintos + 1 NFref retorno.  
**Deps:** A, C. **Files:** `emit-sale-note.ts`, testes venda.

### Phase 4 — UI detalhe (Task F)

**Task F: `nfeReferenciaChaves` na API + página detalhe**  
- Mapper carrega chaves distintas dos consumos (retorno) ou `[ref]`  
- Página `/nfe/[chave]`: lista de links  

**Verify:** abrir retorno multi-remessa → 2 links.  
**Deps:** D. **Files:** `fiscal-mappers.ts`, `fiscal-types.ts`, `nfe/[chave]/page.tsx`.

### Phase 5 — Fechamento (Task G)

**Task G: Smoke + docs**  
- Checklist homologação no spec  
- Atualizar CAT/docs se necessário (já plural)  
- Pedir autorização para commit  

**Verify:** smoke manual. **Deps:** A–F.

## Checkpoints

1. Após A: testes nfe-xml verdes  
2. Após C: pedido com 2 orderIds  
3. Após D+E: XMLs corretos  
4. Após F: UI lista N refs  
5. Após G: humano autoriza commit

## Out of scope

- Devolução por xPed do det  
- Rename `pedido_ml` → `pack_id`  
- Alterar FIFO
