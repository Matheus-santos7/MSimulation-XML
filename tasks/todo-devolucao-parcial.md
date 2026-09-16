# Todo: Devolução parcial de venda

Spec: [`docs/specs/devolucao-parcial.md`](../docs/specs/devolucao-parcial.md) **IMPLEMENTING**  
Plan: [`tasks/plan-devolucao-parcial.md`](./plan-devolucao-parcial.md)

**Status:** 2026-09-16 — Tasks A–H implementadas (TDD). Suítes `backend` (203) e `nfe-xml` (62) verdes; `tsc` backend/frontend e `eslint` limpos. ASSUMPTIONS da spec + smoke humano pendentes.

## Tasks
- [x] Task A: tax domain — `mirrorOriginForDevolucao` por item
- [x] Task B: domain — `devolucao-itens.ts` (linhas devolvíveis + validação)
- [x] Task C: FIFO — estorno parcial por produto
- [x] Task D: remessa simbólica multi-item
- [x] Task E: repositório + port + use case + controller + schema
- [x] Task F: nfe-xml — teste DEVOLUCAO multi-item
- [x] Task G: frontend — dialog + flags
- [x] Task H: verificação + docs (`regras-fulfillment-cat31.md` §4.1)

## Decisões humanas
- [ ] Confirmar ASSUMPTIONS 1–6 da spec
- [ ] Smoke homologação OK (venda 2 itens → parcial → restante → 409)
- [ ] Commit (quando pedir)
- [ ] Push (quando pedir)
