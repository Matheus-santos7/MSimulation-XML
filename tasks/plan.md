# Implementation Plan: `<infCpl>` fulfillment EBazar / ML Full

## Overview

Implementar o composer canônico de `NF-e.infAdic.infCpl` conforme [`docs/specs/infcpl-fulfillment-ebazar.md`](../docs/specs/infcpl-fulfillment-ebazar.md): `{head} {middle?} {regime?}` em ASCII, regimes por UF+CNPJ, preservar impostos na venda, IE nas remessas, interpolação n+serie+data em devolução/insucesso, e novos `NFeTipo` `RETORNO_FISICO` + `INSULCESSO_DE_ENTREGA`.

## Architecture Decisions

- **Composer em `packages/fiscal-core/src/infcpl/`** — compartilhado backend + nfe-xml; export via `fiscal-core` index.
- **Builders só montam inputs** (operation, uf, cnpj, middle, nfeOrigem) e passam `extraInfCpl` ao `buildInfAdicNode`.
- **`buildVendaInfCplText` vira miolo** — extrair abertura; head vem do composer (`VENDA_FULFILLMENT`).
- **Helpers legados** (`remessaInfCplText`, `retornoInfCplText`, `remessaSimbolicaPosDevolucaoInfCplText`) → thin wrappers `@deprecated` apontando ao composer (remoção total = Ask first / task final opcional).
- **`REMESSA_AVANCO`** → `operation: "REMESSA"`; **`TRANSFERENCIA_FILIAL`** → `operation: "TRANSFERENCIA"`.
- **Novos tipos:** migration Prisma + union `NFeTipoXml` + factory. **Emissão completa (UI/use-cases)** de `RETORNO_FISICO` / `INSULCESSO_DE_ENTREGA` fica em Phase 5 (**Ask first** antes de executar).
- **`mensagemPadrao` / DIFAL em `buildInfAdicNode`:** join por **espaço único** (alinhado ao composer; sem `|`) + linha DIFAL do emitter quando aplicável.

## Dependency graph

```
Composer + regimes + unit tests (fiscal-core)
    │
    ├── Refactor miolo venda (buildVendaInfCplText → middle only)
    │
    ├── Wire remessa / retorno / transferência builders
    │
    ├── Wire venda + devolução builders (+ payload origem)
    │
    ├── Prisma NFeTipo + NFeTipoXml + factory/builders stubs
    │
    └── (Ask first) Emissão use-cases / UI novos tipos + docs CAT 31
```

## Task List

### Phase 1: Foundation (composer)

#### Task 1: Mapa de regimes + `resolveRegimeEspecial`
**Acceptance:** 8 pares UF/CNPJ ASCII; match por dígitos; mismatch → `null`.  
**Verify:** `pnpm --filter @msimulation-xml/fiscal-core test` (novos testes).  
**Deps:** None. **Scope:** S — `fulfillment-infcpl.regimes.ts` + test.

#### Task 2: `buildFulfillmentInfCplText` (head + middle + regime)
**Acceptance:** Todas as operations da spec; interpolação n+serie+data (`America/Sao_Paulo`); ASCII; `REMESSA` head usado também para avanço no caller.  
**Verify:** unit tests composer.  
**Deps:** Task 1. **Scope:** S–M — `fulfillment-infcpl.ts` + test + export `index.ts`.

### Checkpoint: Foundation
- [ ] Unit tests do composer 100% operations + 8 regimes
- [ ] `fiscal-core` build OK
- [ ] Review humano opcional antes de wiring

### Phase 2: Wire builders existentes

#### Task 3: Remessa / simbólica / avanço / transferência → composer
**Acceptance:** XML `<infCpl>` com head nova + IE no miolo (quando houver) + regime; pós-devolução inclui ref n/serie/data; sem abertura CAT 31.  
**Verify:** `pnpm --filter @msimulation-xml/nfe-xml test` (asserts em `build-remessa.test.ts`).  
**Deps:** Task 2. **Scope:** M — `remessa.builder.ts`, `fiscal-xml.util.ts` (wrappers), testes.

#### Task 4: Retorno simbólico → composer (sem IE no miolo)
**Acceptance:** Head retorno + regime; sem IE no `infCpl`.  
**Verify:** asserts retorno em `build-remessa.test.ts`.  
**Deps:** Task 2. **Scope:** S — `retorno.builder.ts` + testes.

#### Task 5: Venda — head composer + miolo com impostos
**Acceptance:** Head `Venda de mercadoria...`; miolo preserva CD + retorno + IBPT + DIFAL; regime no fim se match.  
**Verify:** `build-venda.test.ts`.  
**Deps:** Task 2. **Scope:** M — `venda-ml-payload.ts`, `venda.builder.ts`, testes.

#### Task 6: Devolução — interpolação origem + composer
**Acceptance:** Head com n+serie+data da venda referenciada; regime se match; payload carrega origem.  
**Verify:** teste XML devolução (novo ou existente) + ajuste `prisma-document-return.repository` se necessário.  
**Deps:** Task 2, Task 5 (padrão venda builder). **Scope:** M — `devolucao.builder.ts`, return repository/payload, testes.

### Checkpoint: Core wiring
- [ ] `nfe-xml` + `fiscal-core` testes verdes
- [ ] Remessa com IE; retorno sem IE; venda com impostos; devolução interpolada
- [ ] Review humano antes dos novos tipos

### Phase 3: Novos `NFeTipo`

#### Task 7: Prisma migration `RETORNO_FISICO` + `INSULCESSO_DE_ENTREGA`
**Acceptance:** Enum no schema; client gera; typecheck backend.  
**Verify:** `prisma migrate` + `tsc --noEmit` backend.  
**Deps:** Checkpoint Core. **Scope:** S — `schema.prisma` + migration.

#### Task 8: `NFeTipoXml` + factory + builders dos novos tipos
**Acceptance:** `RETORNO_FISICO` via builder retorno (ou strategy dedicada); `INSULCESSO_DE_ENTREGA` via strategy devolução; factory lista tipos; teste factory.  
**Verify:** `nfe-factory.test.ts` + build XML mínimo.  
**Deps:** Task 7, Tasks 4–6. **Scope:** M — `types.ts`, `nfe-factory.ts`, builders, `fiscal-core/nfe-tipo.ts` se espelhar, frontend `fiscal-types` union.

### Checkpoint: Tipos
- [ ] Enum + factory suportam os 2 tipos
- [ ] XML mínimo gera `infCpl` correto para ambos
- [ ] **Stop:** Ask first antes de Phase 5 (emissão/UI)

### Phase 4: Cleanup

#### Task 9: Deprecar helpers legados + alinhar exports
**Acceptance:** Call sites usam composer; helpers `@deprecated` ou removidos (Ask first se remove).  
**Verify:** suites verdes; sem imports órfãos críticos.  
**Deps:** Tasks 3–6. **Scope:** S–M.

#### Task 10 (opcional): Atualizar `regras-fulfillment-cat31.md` § infCpl
**Acceptance:** Doc reflete head ASCII + IE remessa + regimes (Ask first).  
**Deps:** Checkpoint Core. **Scope:** S.

### Phase 5: Ask first — emissão completa dos novos tipos

#### Task 11 (bloqueada): Use-cases / UI `RETORNO_FISICO` + `INSULCESSO_DE_ENTREGA`
**Acceptance:** a definir com o humano (endpoints, telas, cadeia fiscal).  
**Deps:** Task 8 + aprovação explícita. **Scope:** L → quebrar após escopo.

### Checkpoint: Complete (Phases 1–4)
- [ ] Success criteria da spec (exceto emissão UI se Phase 5 adiada)
- [ ] Ready for `code-review-and-quality`

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Quebra de asserts XML legados CAT 31 | Med | Atualizar testes na mesma task do wire |
| `buildVendaInfCplText` usado fora do builder | Med | Grep call sites antes do refactor (Task 5) |
| Migration enum em prod/staging | Med | Migration só add-value; sem rename |
| Escopo UI novos tipos estoura fatia | High | Phase 5 Ask first |
| `mensagemPadrao` vs espaço do composer | Low | Resolvido: auxiliary também junta com espaço |

## Open Questions — resolvidas (2026-07-23)

1. **Phase 5 nesta entrega** (emissão completa).
2. Helpers legados: **remover** (não só deprecate).
3. Doc CAT 31: **sim** nesta entrega (Task 10).
