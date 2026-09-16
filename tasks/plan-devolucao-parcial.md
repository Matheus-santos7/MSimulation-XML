# Implementation Plan: Devolução parcial de venda

Spec: [`docs/specs/devolucao-parcial.md`](../docs/specs/devolucao-parcial.md) **IMPLEMENTING**

## Dependency graph

```
Task A: tax domain — mirrorOriginForDevolucao por item
    │
Task B: fiscal-documents domain — linhas devolvíveis + validação (puro)
    │
Task C: FIFO — estorno parcial por produto (janela sobre consumos)
    │
Task D: remessa simbólica multi-item (prepareSymbolicShipmentFiscal.itens)
    │
    └── Task E: repositório + port + use case + controller + schema (GET/POST)
            │
            ├── Task F: nfe-xml — teste DEVOLUCAO multi-item
            └── Task G: frontend (API client, actions, dialog, flags da lista)
                    │
                    └── Task H: verificação (tsc/lint/testes) + docs fiscais
```

A–D são independentes entre si (puros/aditivos); E depende de todos; F/G dependem de E (contrato).

## Tasks

### Task A — tax domain
**Acceptance:** `mirrorOriginForDevolucao({ origin, itens: [{numeroItem, quantidade}], nonContributorIpi })` espelha só as linhas pedidas, ratio por linha, `vProd = round2(qtd×vUn)`, renumera `numeroItem`, `pDevol = round2(ratio×100)`; `ratio` global continua funcionando (compat).  
**Verify:** `mirror-origin-for-devolucao.test.ts`. **Scope:** S.

### Task B — domain devolução (novo `devolucao-itens.ts`)
**Acceptance:** `computeReturnableLines(saleLines, priorReturns)` (legado sem itens = integral; agregação por produto distribuída em ordem de linha); `resolveRequestedReturnLines(available, requested?)` → lista validada ou `DevolucaoItensError(status)`.  
**Verify:** `devolucao-itens.test.ts`; adicionar ao `package.json#test`. **Scope:** S.

### Task C — FIFO parcial
**Acceptance:** `reverseRemessaFifoConsumptionsForReturn(tx, retornoNfeId, linhas[{productId, quantidade, jaEstornado}])` credita apenas a janela `[jaEstornado, jaEstornado+quantidade)` dos consumos do produto (ordem `createdAt,id`).  
**Verify:** `remessa-fifo-return-reversal.test.ts`; adicionar ao `package.json#test`. **Scope:** S.

### Task D — remessa simbólica multi-item
**Acceptance:** `prepareSymbolicShipmentFiscal` aceita `itens?: [{product, quantidade}]`; engine com N itens (regra fiscal por produto), `calc.valor = vNF`, `quantidadeTotal` = soma; single-product inalterado.  
**Verify:** caso novo em `symbolic-shipment-fiscal.test.ts`. **Scope:** S/M.

### Task E — repositório + API
**Acceptance:** `GET /nfes/:chave/devolucao` lista linhas; `POST` aceita `itens?`; devolução cria `NfeItem` por linha e XML com produtos por `det`; FIFO parcial; remessa simbólica multi-item com `NfeItem`; 409 só quando nada resta.  
**Deps:** A–D. **Verify:** `tsc --noEmit` backend; suíte backend. **Scope:** M.

### Task F — nfe-xml
**Acceptance:** DEVOLUCAO com 2 engine.itens + `nfe.itens[].product` → 2 `<det>` com `cProd` de cada produto e `qCom` das linhas.  
**Verify:** `pnpm --filter @msimulation-xml/nfe-xml test`. **Scope:** S.

### Task G — frontend
**Acceptance:** dialog carrega `GET`, tabela com inputs por linha (default = disponível), envia `itens`; lista mostra "devolvido x/y" e mantém botão até zerar; insucesso/cancelamento desabilitados se houver devolução.  
**Deps:** E. **Verify:** `typecheck` + `lint`. **Scope:** M.

### Task H — verificação + docs
**Acceptance:** suítes verdes; `backend/docs/fiscal/regras-fulfillment-cat31.md` §4.1 ganha nota sobre devolução parcial; todo atualizado.

## Risks

| Risk | Mitigation |
|------|------------|
| Arredondamento por linha faz Σ parciais ≠ integral em R$ 0,01 | aceito/documentado; cada nota fecha `vNF` pelos próprios itens |
| Venda legada sem `engine` multi-item | só single-item via fallback TaxRule (quantidade parcial permitida) |
| Produto do `det` não identificável | 422 explícito em vez de XML com `SKU-n-i` |
| Devoluções antigas sem `NfeItem` | tratadas como integrais (eram sempre `ratio: 1`) |
| Cancelamento bloqueado por devolução parcial | mantido (qualquer devolução bloqueia cancelar a venda) |
