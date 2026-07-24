# Intent: Retorno/Venda com multi-remessa NFref + xPed por item

> **STATUS: CONFIRMED** (2026-07-24)  
> Spec: [`docs/specs/multi-remessa-nfref-xped.md`](../specs/multi-remessa-nfref-xped.md) **APPROVED**

## Problema

Estoque Full pode vir de várias remessas. O sistema debita FIFO e emite retorno/venda consolidados, mas o XML do retorno só referencia a **primeira** remessa. Além disso, o ML usa **packId** (pedido) + **orderId por produto** (`xPed` por `nItem`) para devolução individual — hoje só existe identificador no nível do pedido.

## Decisões humanas

1. `xPed` por `nItem`; pedido = packId (`pedidoMl`); vários orderIds por produto.
2. Ao criar o pedido, cada produto adicionado **gera** orderId (pedido/produto).
3. Incluir **RETORNO_FISICO** na mesma fatia.
4. UI detalhe NF-e lista **N** chaves referenciadas.

## Veredito de cobertura (pré-implementação)

**Parcial** → gaps: multi-`NFref` XML, `PedidoItem.xPed`, UI multi-ref, RETORNO_FISICO multi-ref.

## Fontes

- CAT 31 §2.2: chave(**s**) das remessas no retorno simbólico / físico.
- Código: `emit-return-note.ts`, `ide.node.ts`, `Pedido`/`PedidoItem`, `nfe/[chave]/page.tsx`.
