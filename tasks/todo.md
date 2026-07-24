# Todo: Multi-remessa NFref + xPed por nItem

Spec: [`docs/specs/multi-remessa-nfref-xped.md`](../docs/specs/multi-remessa-nfref-xped.md) **APPROVED**  
Plan: [`tasks/plan-multi-remessa-nfref-xped.md`](./plan-multi-remessa-nfref-xped.md)  
Intent: [`docs/intent/multi-remessa-nfref-xped.md`](../docs/intent/multi-remessa-nfref-xped.md) **CONFIRMED**

**Status:** 2026-07-24 — Tasks A–F implementadas (TDD). Smoke humano + commit/push pendentes.

## Tasks
- [x] Task A: nfe-xml — multi-NFref + xPed por det
- [x] Task B: Prisma — `PedidoItem.xPed` + migration
- [x] Task C: API + domain + wizard (pack + orderId ao add item)
- [x] Task D: RETORNO_SIMBOLICO + RETORNO_FISICO — coletar N chaves
- [x] Task E: emit-sale-note — xPed por item
- [x] Task F: API/UI detalhe — `nfeReferenciaChaves[]`
- [x] Task G: docs/smoke checklist (sem commit)

## Decisões humanas
- [x] Spec APPROVED
- [x] Plan APPROVED → IMPLEMENT
- [ ] Smoke homologação OK
- [ ] Commit (quando pedir)
- [ ] Push (quando pedir)
