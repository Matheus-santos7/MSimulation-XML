# Todo: `<infCpl>` fulfillment EBazar / ML Full

Spec: [`docs/specs/infcpl-fulfillment-ebazar.md`](../docs/specs/infcpl-fulfillment-ebazar.md)  
Plan: [`tasks/plan.md`](./plan.md)

**Status:** plano aprovado (2026-07-23) — Phase 5 nesta entrega; helpers removidos; doc CAT 31 sim

## Phase 1 — Foundation
- [x] Task 1: Mapa regimes + `resolveRegimeEspecial` + testes
- [x] Task 2: `buildFulfillmentInfCplText` + export fiscal-core + testes

### Checkpoint Foundation
- [x] Unit composer: operations + 8 regimes
- [x] `pnpm --filter @msimulation-xml/fiscal-core test` verde

## Phase 2 — Wire builders
- [x] Task 3: Remessa / simbólica / avanço / transferência → composer + testes XML
- [x] Task 4: Retorno simbólico → composer (sem IE) + testes
- [x] Task 5: Venda head + miolo impostos + regime + testes
- [x] Task 6: Devolução interpolação n+serie+data + payload + testes

### Checkpoint Core wiring
- [x] `pnpm --filter @msimulation-xml/nfe-xml test` verde
- [ ] Review humano

## Phase 3 — Novos tipos
- [x] Task 7: Prisma `RETORNO_FISICO` + `INSULCESSO_DE_ENTREGA`
- [x] Task 8: `NFeTipoXml` + factory + builders + testes

### Checkpoint Tipos
- [x] XML mínimo dos 2 tipos com `infCpl` correto
- [x] Phase 5 nesta entrega

## Phase 4 — Cleanup
- [x] Task 9: Remover helpers legados
- [x] Task 10: Doc `regras-fulfillment-cat31.md`

## Phase 5 — Emissão
- [x] Task 11: Emissão/UI `RETORNO_FISICO` + `INSULCESSO_DE_ENTREGA`

## Aprovação humana
- [x] Plano aprovado
- [x] Q1 Phase 5: nesta entrega
- [x] Q2 Helpers: remover
- [x] Q3 Doc CAT 31: sim

