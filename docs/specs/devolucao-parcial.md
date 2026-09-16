# Spec: Devolução parcial de venda (por item e por quantidade)

> **STATUS: IMPLEMENTING** (2026-09-16) — spec escrita em sessão autônoma; ASSUMPTIONS abaixo aguardam confirmação humana.  
> Plan: [`tasks/plan-devolucao-parcial.md`](../../tasks/plan-devolucao-parcial.md) · Todo: [`tasks/todo-devolucao-parcial.md`](../../tasks/todo-devolucao-parcial.md)  
> Specs relacionadas: `docs/specs/multi-remessa-nfref-xped.md` (decisão 8 deixava devolução por item fora de escopo), `backend/docs/fiscal/regras-fulfillment-cat31.md` §4.  
> **Governança:** sem commit/push sem autorização humana explícita.

---

## Objective

Permitir que uma NF-e de **VENDA** com N itens seja devolvida **parcialmente** — escolhendo quais `nItem` voltam e em que quantidade — e que a mesma venda receba **várias devoluções** até esgotar as quantidades vendidas.

Hoje (`POST /api/nfes/:chave/devolucao`) a devolução é sempre integral (`ratio: 1` sobre todos os itens), só uma por venda (409 na segunda) e o `<det>` 2+ da devolução sai sem cadastro de produto (XML usa apenas o produto do cabeçalho).

### User stories

- Como operador Full ML, o comprador devolveu **1 das 2 unidades** do item 2 → emito devolução só dessa unidade, com bases/impostos proporcionais, e mais tarde consigo devolver o restante.
- Como operador, o comprador devolveu **só o item 1** de uma venda com 2 SKUs → a devolução tem um único `<det>` com o produto correto; a remessa simbólica de reposição ao CD leva só esse produto/quantidade.
- Como operador, vejo na lista de NF-e que a venda está **parcialmente devolvida** e o botão "Devolver" continua ativo até zerar.

## Regras fiscais aplicadas (por quê)

| Regra | Fonte | Aplicação |
|---|---|---|
| Devolução espelha a nota de origem, **proporcional** à quantidade devolvida; não recalcula imposto "do zero" | MOC 7.0 (finNFe=4) · `mirror-origin-for-devolucao.ts` | ratio por item = `qtdDevolvida / qtdOrigem`; bases e impostos escalados e arredondados **por item** (`round2`) antes da soma |
| `vProd = qCom × vUnCom` | MOC (validação do item) | `vProd` da linha devolvida = `round2(qtd × valorUnitario)` (não o `vProd` origem escalado) |
| Totais = `reduce` dos itens arredondados; `vNF = vProd − vDesc + vFrete + vSeg + vOutro + vST + vIPI (+ vIPIDevol)` | Regra de fechamento SEFAZ · `calcularTotais` | inalterado — totais derivam dos itens espelhados |
| IPI de não contribuinte → `<impostoDevol>` (`pDevol`, `vIPIDevol`); `vIPI` = 0 | NT 2016.002 | `pDevol` = percentual da mercadoria devolvida = `round2(ratio × 100)` (100 na devolução integral, igual a hoje) |
| DIFAL/FCP: mantêm `vICMSUFDest`/`vICMSUFRemet` da saída (não inverte); FCP só em `vFCPUFDest` | EC 87/15 · NT 2015.003 | inalterado (escala proporcional) |
| `<NFref>` da venda + `infCpl` "Devolucao de mercadoria referente a NF-e de origem n … serie … emitida em …" | CAT 31 §4.1 | inalterado; vale para cada devolução parcial |
| Reposição ao CD: remessa simbólica **referenciando a devolução**, com os itens devolvidos | CAT 31 §4.2 | 1 REMESSA_SIMBOLICA multi-item (modelo consolidado, mesma decisão da spec multi-remessa) |
| `nItem` sequencial a partir de 1 | MOC (schema `det`) | linhas devolvidas são renumeradas 1..n; o `nItem` de origem fica em `fiscalPayload.devolucaoItens[].nItemOrigem` |

## Tech Stack

Node 20 + TypeScript (ESM) · Fastify 5 · Prisma 7 (PostgreSQL) · `@msimulation-xml/fiscal-core` · `@msimulation-xml/nfe-xml` · Next 16 / React 19 / shadcn-ui · `node:test`.

## Commands

```bash
# domínio + infra backend (arquivos-alvo desta feature)
cd backend && node --import tsx --test \
  src/modules/tax/domain/services/mirror-origin-for-devolucao.test.ts \
  src/modules/fiscal-documents/domain/services/devolucao-itens.test.ts \
  src/modules/remessas/infrastructure/fifo/remessa-fifo-return-reversal.test.ts \
  src/modules/remessas/infrastructure/fiscal/symbolic-shipment/symbolic-shipment-fiscal.test.ts

pnpm --filter @msimulation-xml/nfe-xml test
pnpm --filter @msimulation-xml/backend test          # suíte completa (inclui os novos arquivos)
pnpm --filter @msimulation-xml/backend exec tsc --noEmit
pnpm --filter @msimulation-xml/frontend typecheck && pnpm --filter @msimulation-xml/frontend lint
```

## Project Structure (arquivos tocados)

```
backend/src/modules/tax/domain/services/mirror-origin-for-devolucao.ts        → itens[] (ratio por linha, renumeração, pDevol)
backend/src/modules/fiscal-documents/domain/services/devolucao-itens.ts       → NOVO: linhas devolvíveis + validação do pedido (puro)
backend/src/modules/fiscal-documents/domain/ports/fiscal-document-lifecycle.port.ts → ProcessReturnInput.itens?, ReturnableItems*
backend/src/modules/fiscal-documents/application/use-cases/process-return.use-case.ts → getReturnableItems
backend/src/modules/fiscal-documents/infrastructure/prisma/prisma-document-return.repository.ts → linhas da venda, NfeItem rows, FIFO parcial, remessa simbólica multi-item
backend/src/modules/fiscal-documents/presentation/{controllers/nfe-lifecycle.controller.ts,schemas/fiscal-document.schemas.ts} → GET/POST
backend/src/modules/remessas/infrastructure/fifo/remessa-fifo-consumption.ts  → reverseRemessaFifoConsumptionsForReturn
backend/src/modules/remessas/infrastructure/fiscal/symbolic-shipment/symbolic-shipment-fiscal.ts → itens[] (multi-linha)
packages/nfe-xml/src/build-venda.test.ts                                      → teste DEVOLUCAO multi-item com produto por det
frontend/src/lib/fiscal-api/nfes.ts · frontend/src/app/(app)/nfe/actions.ts   → getReturnableItems / emitReturnNote(chave, itens)
frontend/src/components/nfe-devolucao-button.tsx                              → dialog com tabela de itens e quantidades
frontend/src/app/(app)/nfe/page.tsx · nfe-row-actions-menu.tsx                → flags "parcial" / "integral"
```

## API

### `GET /api/nfes/:chave/devolucao` (ADMIN)

```jsonc
{
  "venda": { "chave": "…", "numero": 12, "serie": 1, "quantidade": 3 },
  "itens": [
    { "numeroItem": 1, "productId": "…", "sku": "A", "nome": "Produto A", "unidade": "UN",
      "quantidadeVendida": 1, "quantidadeDevolvida": 0, "quantidadeDisponivel": 1, "valorUnitario": 100 },
    { "numeroItem": 2, "productId": "…", "sku": "B", "nome": "Produto B", "unidade": "UN",
      "quantidadeVendida": 2, "quantidadeDevolvida": 1, "quantidadeDisponivel": 1, "valorUnitario": 50 }
  ],
  "quantidadeDevolvida": 1,
  "quantidadeDisponivel": 2,
  "devolucoes": [{ "chave": "…", "numero": 40, "serie": 1, "tipo": "DEVOLUCAO", "quantidade": 1 }]
}
```

### `POST /api/nfes/:chave/devolucao` (ADMIN)

Body opcional: `{ "itens": [{ "numeroItem": 2, "quantidade": 1 }] }`.  
Sem body / sem `itens` → devolve **tudo que resta** (compatível com o comportamento atual na primeira devolução).

| Situação | HTTP |
|---|---|
| venda não encontrada | 404 |
| NF-e não é VENDA / sem produto identificável | 422 |
| nada mais a devolver | 409 `Venda já devolvida integralmente (NF-e n/s…)` |
| `numeroItem` inexistente, duplicado, `quantidade` ≤ 0 ou > disponível | 422 |

`POST /api/nfes/:chave/insulcesso` continua **sem body**: insucesso de entrega devolve tudo que resta.

## Code Style

```ts
// Domínio puro, testável sem Prisma: linhas da venda + devoluções anteriores → disponível por linha.
const disponiveis = computeReturnableLines(saleLines, priorReturns);
const pedido = resolveRequestedReturnLines(disponiveis, body.itens); // lança DevolucaoItensError(status, msg)

// Espelho proporcional por item (tax domain) — renumera nItem e usa qtd × vUn no vProd.
const invoice = mirrorOriginForDevolucao({
  origin: engine,
  itens: pedido.map((l) => ({ numeroItem: l.numeroItem, quantidade: l.quantidade })),
  nonContributorIpi: customerType === "non_taxpayer",
});
```

## Testing Strategy

| Nível | Caso |
|---|---|
| Unit tax (`mirror-origin-for-devolucao.test.ts`) | 2 itens, devolve 1 de 2 do item 2 → 1 `det` renumerado, bases 50 %, `vProd = qtd×vUn`, `pDevol = 50`; `numeroItem` inválido / qtd > origem lançam |
| Unit domain (`devolucao-itens.test.ts`) | disponível por linha após devoluções anteriores (com e sem `itens` legados); pedido vazio → tudo que resta; validações 409/422 |
| Unit FIFO (`remessa-fifo-return-reversal.test.ts`) | estorno janela: 2ª devolução não re-credita o que a 1ª já creditou; produto sem consumo → nada |
| Unit remessas (`symbolic-shipment-fiscal.test.ts`) | `itens[]` com 2 produtos → engine com 2 itens e `valor` = soma |
| Unit nfe-xml (`build-venda.test.ts`) | DEVOLUCAO com 2 `engine.itens` + `nfe.itens[].product` → 2 `<det>` com `cProd` corretos |
| Regressão | devolução integral de venda single-item mantém XML/valores (ratio 1 ⇒ `pDevol` 100, mesmos totais) |

## Boundaries

- **Always:** arredondar por item antes de somar; `vProd = qCom×vUnCom`; testes antes de pedir commit; citar MOC/NT/CAT 31 no código onde a regra aparece.
- **Ask first:** mudanças de schema Prisma (**evitadas** nesta fatia — usa `NfeItem` existente + `fiscalPayload`); alterar contrato do `INSULCESSO`; renomear rotas.
- **Never:** commit/push sem OK; chumbar alíquotas; gerar `vICMS > 0` com base/alíquota zeradas; inverter DIFAL na devolução.

## Success Criteria

1. Venda 2 itens → `POST` com `itens:[{numeroItem:2, quantidade:1}]` gera DEVOLUCAO com 1 `det` (produto B, qCom 1, valores ≈ 50 % da linha origem), `NFref` da venda, `NfeItem` persistido; FIFO credita 1 un. do produto B na remessa correta; REMESSA_SIMBOLICA com produto B × 1 referenciando a devolução.
2. Segunda chamada sem body devolve o restante (item 1 × 1 + item 2 × 1); terceira → 409.
3. Soma dos `vNF` das devoluções parciais = `vNF` da devolução integral equivalente (± R$ 0,01 por linha por arredondamento — aceitável e documentado).
4. UI: dialog lista itens com vendida/devolvida/disponível, inputs por linha, default = tudo; lista marca venda parcialmente devolvida e mantém "Devolver" ativo.
5. `tsc` backend/frontend, `lint` frontend e suítes `backend` + `nfe-xml` verdes.

## ASSUMPTIONS (a confirmar)

1. **`pDevol` proporcional** (`qtdDevolvida/qtdOrigem × 100`) em vez de 100 fixo para devolução parcial de linha com IPI.
2. **Remessa simbólica de reposição consolidada** (1 NF-e multi-item) em vez de 1 NF-e por produto devolvido.
3. Devoluções **legadas** (sem `NfeItem`) contam como **integrais** para o cálculo do que resta.
4. **Insucesso de entrega** permanece integral (tudo que resta) e fica desabilitado na UI quando já existe qualquer devolução.
5. Identificação do produto por `det` da venda: `Pedido.itens` (mesma ordem) → SKU do `engine.itens[].codigo` → produto do cabeçalho (single-item).
6. Sem mudança de schema: origem do `nItem` e mapa de linhas gravados em `fiscalPayload.devolucaoItens`.

## Out of scope

- Cancelamento de devolução (parcial ou não).
- Devolução por `xPed`/orderId ML.
- Devolução de vendas sem `engine` persistido com mais de 1 item (legado: só single-item, com quantidade parcial).
