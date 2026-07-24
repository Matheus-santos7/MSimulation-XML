# Spec: Motor ICMS-ST (vBCST / vICMSST)

> **STATUS: DONE** (2026-07-24)  
> Decisão Q3: ST antes do próximo processo ML.  
> CFOPs alvo: `5405`, `6403`, `6404` (árvore estoque próprio + `sujeitoSt`).  
> Smoke ST homologação: **OK** (2026-07-24).

## Objective

Calcular e emitir ICMS-ST no caminho SALE (tax-engine → `fiscalPayload.engine` → XML), fechando `vBCST` / `vICMSST` (e Ret quando CST 60) e totais `ICMSTot.vBCST` / `vST` / `vNF`.

## Assumptions (confirmadas na implementação)

1. **CST 10 / 70** — ST na operação:  
   `vBCST = round2(baseOp × (1 + MVA/100) × (1 − pRedBCST/100))`  
   `vICMSST = max(0, round2(vBCST × pICMSST/100) − vICMS)`  
   Soma em `totais.vBCST`, `totais.vST` e `vNF`.
2. **CST 30** — sem ICMS próprio; `vICMSST = round2(vBCST × pICMSST/100)`.
3. **CST 60** — imposto já retido (`5405` / `6404` típicos): tags `*STRet`; **não** entra em `vST`/`vNF`.
4. **pICMSST** — `TaxRule` `PICMSST_RET`; se 0, fallback alíquota interna do destino (`PICMS_INTERNAL`).
5. **baseOp** — mesma base bruta do ICMS antes de `pRedBC` (e com IPI se consumidor final).
6. **CEST** obrigatório se CFOP ∈ {5405, 6403, 6404}.
7. **CSOSN** (Simples) fora desta fatia.
8. Alíquotas/MVA **só** da TaxRule / settings — sem hardcode.

## Acceptance

- [x] `calcularItem` preenche campos ST no `icms` do item
- [x] `calcularTotais` soma `vBCST`/`vST` e inclui `vST` em `vNF`
- [x] `buildFiscalItem` injeta MVA / pRedBCST / pICMSST do snapshot
- [x] `resolveIcmsFromEngine` emite ICMS10/30/70/60 com tags ST
- [x] `ICMSTot` no XML usa `vBCST`/`vST` do engine (não hardcode `0.00`)
- [x] CFOP ST sem CEST → erro de domínio
- [x] Testes: CST 10 (com crédito), CST 60 (Ret, vNF sem ST), totais

> **STATUS: DONE** (2026-07-24) — fatia engine+XML+CEST; smoke ST em homologação ainda manual.

## Commands

```bash
pnpm --filter @msimulation-xml/backend exec tsx --test src/modules/tax/domain/services/tax-engine.test.ts
pnpm --filter @msimulation-xml/backend exec tsx --test src/modules/tax/application/services/tax-calculation.service.test.ts
pnpm --filter @msimulation-xml/nfe-xml test
pnpm --filter @msimulation-xml/backend exec tsc --noEmit
```

## Boundaries

**Always:** arredondar item a item; `vNF` com `vST`; CEST em ST.  
**Ask first:** CSOSN ST; FCP-ST na `vNF`; seed TaxRule ST em massa.  
**Never:** alíquota/MVA literais no código de emissão.
