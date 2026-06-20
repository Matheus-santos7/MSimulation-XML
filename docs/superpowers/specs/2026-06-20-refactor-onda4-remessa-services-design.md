# Refatoração Onda 4 — Remessa Services (Design Spec)

**Data:** 2026-06-20  
**Status:** Concluída (2026-06-20)  
**Objetivo:** Dividir god files de emissão de remessa/transferência em módulos focados, renomear exports públicos para inglês e revisar serviços vizinhos — sem alterar comportamento fiscal ou contratos HTTP.

## Roadmap geral (ordem aprovada)

| Onda | Foco | Status |
|------|------|--------|
| **4 — A** | Split `remessa-service`, `transferencia-filial-service` + vizinhos + EN | Este spec |
| **5 — B** | Consolidar `xml-serializer` (`fiscal-core` ← `nfe-xml`) | Spec futuro |
| **6 — C** | Frontend EN + simplificar forms/páginas grandes | Spec futuro |

## Contexto

Quick wins (ondas 1–3), split `remessa-fifo`, `fiscal-api` e CT-e objeto+serializador já concluídos. Hotspots backend restantes na pasta `remessas/infrastructure/fiscal/`:

| Arquivo | Linhas | Papel |
|---------|--------|-------|
| `remessa-service.ts` | ~411 | Remessa física ML (fases 2–10 de `docs/remessa-fisica.md`) |
| `transferencia-filial-service.ts` | ~468 | Transferência matriz→filial + remessa automática ao CD |
| `remessa-simbolica-fiscal.ts` | ~171 | Preparação fiscal remessa simbólica (5949/6949) |
| `cte-remessa-service.ts` | ~28 | CT-e 1:1 pós-remessa |

`transferencia-filial-service` importa `emitirRemessaComItens` de `remessa-service`. Há overlap de lógica (tax rule, engine, persist XML, FIFO realign) — **pipeline compartilhado fica fora desta onda**.

## Abordagem escolhida

**Split por domínio + vizinhos (Abordagem 3)** — espelha o padrão de `remessa-fifo/`:

- Pastas `physical-shipment/`, `branch-transfer/`, `symbolic-shipment/`
- Barrels PT (`remessa-service.ts`, `transferencia-filial-service.ts`) finos por um ciclo, depois removíveis
- Duplicação local aceita; extração de pipeline só se necessário após a onda

## Estrutura alvo

```
backend/src/modules/remessas/infrastructure/fiscal/
├── physical-shipment/
│   ├── physical-shipment.errors.ts
│   ├── physical-shipment.types.ts
│   ├── physical-shipment-destination.mapper.ts
│   ├── physical-shipment-tax-lines.ts
│   ├── physical-shipment-core.ts
│   ├── physical-shipment-manual.ts
│   └── index.ts
├── branch-transfer/
│   ├── branch-transfer.errors.ts
│   ├── branch-transfer.types.ts
│   ├── branch-transfer.validation.ts
│   ├── branch-transfer-emission.ts
│   └── index.ts
├── symbolic-shipment/
│   ├── symbolic-shipment.errors.ts
│   ├── symbolic-shipment.types.ts
│   ├── symbolic-shipment-fiscal.ts
│   └── index.ts
├── shipment-cte.service.ts
├── remessa-service.ts              # barrel → physical-shipment (transitório)
└── transferencia-filial-service.ts # barrel → branch-transfer (transitório)
```

### Responsabilidades

| Módulo | Responsabilidade |
|--------|------------------|
| `physical-shipment-tax-lines` | Fase 3: custo, `resolveTaxRule` inbound, CFOP remessa por item |
| `physical-shipment-core` | Fases 4–9: engine, chave, transação, payload, NF-e, itens, movimentação, XML, CT-e |
| `physical-shipment-manual` | Entry UI: carrega tenant/produtos, FIFO realign, delega ao core |
| `physical-shipment-destination.mapper` | `destinoToNfeFields` → colunas `dest*` |
| `branch-transfer.validation` | Filial, CD padrão, matriz≠filial, regras duplas (transferência + remessa) |
| `branch-transfer-emission` | NF-e `TRANSFERENCIA_FILIAL`; orquestra `emitShipmentWithItems` |
| `symbolic-shipment-fiscal` | `prepareSymbolicShipmentFiscal` + tipos |
| `shipment-cte.service` | `emitShipmentCte` (rename de `emitirCteRemessa`) |

## Tabela de rename (exports públicos)

| Atual (PT) | Novo (EN) |
|------------|-----------|
| `emitirRemessaManual` | `emitManualShipment` |
| `emitirNFeRemessa` | `emitShipmentNfe` |
| `emitirRemessaComItens` | `emitShipmentWithItems` |
| `EmitirRemessaOptions` | `EmitShipmentOptions` |
| `RemessaManualItemInput` | `ManualShipmentItemInput` |
| `RemessaError` | `ShipmentError` |
| `emitirTransferenciaFilial` | `emitBranchTransfer` |
| `TransferenciaFilialError` | `BranchTransferError` |
| `TransferenciaFilialItemInput` | `BranchTransferItemInput` |
| `emitirCteRemessa` | `emitShipmentCte` |
| `prepararRemessaSimbolicaFiscal` | `prepareSymbolicShipmentFiscal` |
| `RemessaSimbolicaFiscalError` | `SymbolicShipmentFiscalError` |
| `RemessaSimbolicaFiscalPreparada` | `SymbolicShipmentFiscalPrepared` |
| `ProdutoRemessaSimbolica` | `SymbolicShipmentProduct` |
| `PrepararRemessaSimbolicaPosDevolucaoInput` | `SymbolicShipmentAfterReturnInput` |

Funções internas (ex.: `emitirNFeRemessaComItens`) → `emitShipmentNfeWithItems` (não exportadas em `remessas/index.ts`).

## Call sites backend (atualizar imports)

- `remessas/index.ts`
- `remessas/infrastructure/factory/remessas-module.factory.ts`
- `logistics/presentation/controllers/movement.controller.ts`
- `remessas/infrastructure/fiscal/fiscal-emissor-adapter.ts`
- `fiscal-documents/infrastructure/prisma/prisma-document-return.repository.ts`
- `remessas/application/use-cases/emitir-avanco-mercadoria.ts`
- `remessas/infrastructure/fiscal/remessa-simbolica-fiscal.test.ts`

## Frontend (fora desta onda)

Rotas HTTP e nomes em `fiscal-api` (`emitirRemessaManual`, `emitirTransferenciaFilial`) permanecem PT até **Onda 6**. Apenas backend muda nesta onda.

## Regras invariantes

1. **Zero mudança** de lógica fiscal, payloads JSON, XML gerado ou shape das respostas HTTP.
2. Mensagens de erro exibidas ao usuário permanecem em **português**.
3. Termos fiscais BR (`Remessa`, `NFe`, `CFOP`, etc.) mantidos onde aplicável.
4. Barrels PT transitórios re-exportam símbolos EN para não quebrar imports internos durante o split.

## Entrega incremental (commits sugeridos)

1. `refactor(remessas): split physical-shipment with EN exports`
2. `refactor(remessas): split branch-transfer with EN exports`
3. `refactor(remessas): rename symbolic-shipment and shipment-cte services`

Cada commit precedido de `pnpm build` + `pnpm test:backend`.

## Verificação

```bash
pnpm build
pnpm test:backend
```

Critérios:

- Exit code 0 em build e testes
- **108/108** testes backend passando
- Grep por exports PT antigos no `backend/src` retorna 0 (exceto barrels transitórios documentados)
- Nenhuma alteração em rotas ou schemas HTTP

## Fora de escopo (Onda 4)

- Pipeline compartilhado de emissão (`shipment-emission.pipeline.ts`)
- Onda 5: unificação `xml-serializer`
- Onda 6: rename frontend + split de páginas/forms
- Split de `fiscal-emissor-adapter.ts`

## Preview — Onda 5 (B)

Mover `packages/nfe-xml/src/core/xml-serializer.ts` para `packages/fiscal-core/src/xml-serializer.ts` como fonte única; `nfe-xml` passa a importar de `@msimulation-xml/fiscal-core`. Evita duplicação introduzida no CT-e refactor. Requer validar que `nfe-xml` não cria dependência circular (hoje `nfe-xml` → `fiscal-core` only).

## Preview — Onda 6 (C)

- Renomear exports PT em `frontend/src/lib/fiscal-api/` alinhados ao backend EN
- Extrair hooks de `regras/page.tsx`, `pedido-wizard-dialog.tsx`, `filial-form.tsx`, `tenant-form-fields.tsx`
- Manter thin client: zero lógica fiscal no browser

## Referências

- `docs/remessa-fisica.md` — mapa fases remessa física
- `docs/superpowers/specs/2026-06-20-refactor-quick-wins-design.md` — ondas 1–3 + remessa-fifo
- `backend/src/modules/remessas/infrastructure/fifo/` — padrão de split adotado
