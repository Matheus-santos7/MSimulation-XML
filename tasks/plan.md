# Implementation Plan: Matriz SALE + CFOP árvore / retorno simbólico

> **SALE + ST:** entregues (2026-07-24).  
> **Próximo:** Conferência INBOUND POSITIVE/NEGATIVE — intent confirmado; spec DRAFT em  
> [`docs/specs/inbound-conference-differences.md`](../docs/specs/inbound-conference-differences.md).  
> Plan detalhado de implementação só após **APPROVED** da spec.

## Overview

Fechar a 1ª fatia do simulador Fulfillment ML (**SALE** = venda + retorno simbólico) conforme [`docs/specs/sale-fulfillment-cfop-matrix.md`](../docs/specs/sale-fulfillment-cfop-matrix.md): CFOP de venda pela árvore de decisão + TaxRule só para impostos; em seguida CFOP de retorno automático (hoje hardcode 1949/2949); depois ST engine e demais processos.

**Já entregue (não reabrir sem necessidade):** árvore `resolveCfopByDecisionTree`, settings `perfilVendedor` / `logisticaPadrao` / `stInterestadualMode`, `Product.sujeitoSt`, homogêneo ST, `assertTaxRuleCfopMatchesTree` (só se CFOP manual), UI forma de faturamento.

**Plano anterior (`infCpl` EBazar):** concluído — ver histórico git / `docs/specs/infcpl-fulfillment-ebazar.md`.

## Architecture Decisions

- **CFOP venda** = árvore (`fiscal-core`); planilha TaxRule XLSX **não** define CFOP (`cfop=""`).
- **Impostos** = TaxRule `sale` (`icmsByUf` + payload) + motor.
- **CFOP retorno** = alvo: TaxRule / resolução por UF+natureza com allowlist ML (`1949`, `2949`, `1904`, `1907`, `2904`, `2907`) — hoje hardcode em `resolveRetornoSimbolicoCfop`.
- **Um CFOP por NF-e** — pedido não mistura ST / não-ST.
- **ST Full** não está na árvore; ST só com `estoque_proprio`. Motor `vBCST` ainda ausente → emissão ST bloqueada ou experimental até Phase 3.

## Dependency graph

```
Smoke homologação (já implementado)
    │
    ├── CFOP retorno simbólico (TaxRule / allowlist / remove hardcode)
    │
    ├── (opcional) Allowlist SALE + validação CFOP venda fora da árvore
    │
    ├── Motor ICMS-ST (vBCST / vICMSST) — necessário p/ 5405/6403/6404
    │
    └── Próximo processo ML (INBOUND ou SALE_RETURN) — Ask first
```

## Task List

### Phase 0: Smoke homologação (já implementado)

#### Task 0: Checklist manual SALE Full
**Description:** Validar ponta a ponta o que já está no código antes de mudar retorno.  
**Acceptance:**
- [ ] Settings: `comercio` + `armazem_geral`
- [ ] Remessa com saldo FIFO + pedido NC intra → venda CFOP `5106`; inter → `6106`
- [ ] Settings `industria` → `5105` / `6105`
- [ ] Par retorno simbólico emitido; `xTexto` `SALE-sale-…` e `SALE-symbolic_inbound_return-…`
- [ ] Pedido misto ST/não-ST rejeitado
- [ ] Migration `sujeito_st` aplicada no ambiente local

**Verification:** emissão via UI/API + inspeção XML.  
**Deps:** None. **Scope:** S (manual).

### Checkpoint: Smoke
- [x] Homolog local OK (2026-07-24)
- [x] Spec marcada APPROVED pelo humano

### Phase 1: CFOP retorno simbólico

#### Task 1: Allowlist + resolução CFOP retorno (sem hardcode como fonte)
**Description:** Substituir `1949`/`2949` fixos por resolução automática (UF emitente↔CD + natureza), validada na allowlist ML `symbolic_inbound_return`. Preferência: TaxRule `symbolic_inbound_return` quando existir campo/uso; senão árvore/regra UF (intra `1949`, inter `2949`) e caminho explícito para `1904`/`1907`/`2904`/`2907` via settings ou regra.  
**Acceptance:**
- [ ] Hardcode deixa de ser única fonte de verdade
- [ ] Allowlist testada
- [ ] Sales Chain / `emit-return-note` usa o novo resolver
- [ ] Unit tests cobertura allowlist + intra/inter

**Verification:** `pnpm --filter @msimulation-xml/fiscal-core test` + teste backend retorno se houver.  
**Deps:** Checkpoint Smoke. **Scope:** M — `retorno-simbolico-dest.ts`, `emit-return-note.ts`, `resolve-sales-chain-rules.ts`, `fiscal-core`.

#### Task 2: `transactionType` retorno alinhado a ML
**Description:** `resolveSalesChainRules` busca impostos de retorno com tipo coerente (`symbolic_inbound_return` ou alias documentado de `inbound` para planilhas legadas).  
**Acceptance:**
- [ ] Resolução de TaxRule do retorno não depende semanticamente de “inbound remessa” sem alias
- [ ] Import XLSX continua funcionando (alias se necessário)
- [ ] Teste de resolução

**Verification:** testes tax-rule-resolution + sales.  
**Deps:** Task 1. **Scope:** M.

### Checkpoint: Retorno
- [ ] Smoke: venda Full + retorno com CFOP esperado (intra/inter)
- [ ] Suites `fiscal-core` + backend relevantes verdes

### Phase 2: Polish SALE (opcional nesta fatia)

#### Task 3: Allowlist CFOP venda vs árvore
**Description:** Validar que CFOP emitido ∈ allowlist SALE da planilha ML (ou ∈ saída da árvore).  
**Acceptance:** CFOP fora → erro de domínio.  
**Deps:** Checkpoint Retorno. **Scope:** S.

### Phase 3: ICMS-ST (Ask first se adiar)

#### Task 4: Cálculo ST no tax-engine + XML
**Description:** `vBCST` / `vICMSST` / tags CST 10/30/60/70 ou CSOSN ST a partir do payload TaxRule.  
**Acceptance:** emissão `5405`/`6403`/`6404` com totais coerentes; teste engine + XML.  
**Deps:** Checkpoint Retorno. **Scope:** L. **Ask first** se priorizar outro processo ML antes.

### Phase 4: Próximo processo ML (Ask first)

#### Task 5: Escolher INBOUND vs SALE_RETURN
**Description:** Próxima linha da `Tabela_Processos_Fulfillment_ML.xlsx`.  
**Deps:** Checkpoint Retorno (+ ST se estoque próprio ST for prioridade). **Scope:** L → novo plan.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| TaxRule import sem CFOP confundir assert | Low | Assert só se `cfop` manual preenchido |
| Alias `inbound` vs `symbolic_inbound_return` quebra import | Med | Alias documentado + testes |
| Emitir ST sem motor | High | Bloquear ST na emissão até Task 4 |
| Escopo “todos os processos” estoura | High | Um processo por plan |

## Open Questions (humano)

1. Spec `sale-fulfillment-cfop-matrix.md`: **aprovar** após smoke? (status hoje DRAFT)
2. Retorno: só `1949`/`2949` por UF na 1ª entrega do retorno, ou já exigir seed para `1904`/`1907`/`2904`/`2907`?
3. ST (Task 4) antes ou depois do próximo processo ML?
