# Implementation Plan: Conferência INBOUND (POSITIVE / NEGATIVE)

Spec: [`docs/specs/inbound-conference-differences.md`](../docs/specs/inbound-conference-differences.md) **APPROVED**  
Intent: [`docs/intent/inbound-conference-differences.md`](../docs/intent/inbound-conference-differences.md)

## Dependency graph

```
Task A: fiscal-core (allowlist + deltas + xTexto)
    │
    ├── Task B: emit NEGATIVE parcial + FIFO −
    │
    ├── Task C: emit POSITIVE + FIFO +
    │
    └── Task D: orquestração conferência + API + UI
            │
            └── Task E: smoke homologação
```

## Tasks

### Task A — fiscal-core
**Acceptance:** allowlists exportadas; `resolveInboundPositiveCfop` / `resolveInboundNegativeCfop` (default UF + assert allowlist); `computeConferenceDeltas`; xTexto POSITIVE/NEGATIVE; testes.  
**Scope:** S — `packages/fiscal-core`.

### Task B — NEGATIVE + FIFO −
**Acceptance:** emitir retorno parcial (qtd = |delta|) referenciando remessa; debitar FIFO; `inbound_return` alias TaxRule se preciso; xTexto novo.  
**Deps:** A. **Scope:** M.

### Task C — POSITIVE + FIFO +
**Acceptance:** emitir remessa-delta; creditar FIFO (nova cobertura ou ajuste); CFOP ∈ allowlist.  
**Deps:** A. **Scope:** M.

### Task D — Orquestração + API + UI
**Acceptance:** endpoint/ação Conferência; esperado = saldo atual; permite reconferência; 1 NF por sinal (itens agregados).  
**Deps:** B, C. **Scope:** M.

### Task E — Smoke
**Acceptance:** checklist da spec. **Deps:** D.

## Risks

| Risk | Mitigation |
|------|------------|
| Retorno físico total legado conflita com delta | Manter `/retorno-fisico` total; conferência é caminho novo |
| POSITIVE multi-CFOP | Default 5949/6949; override validado na allowlist |
| Reconferência | expected = FIFO atual |
