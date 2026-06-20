# Onda 4 — Remessa Services Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `remessa-service.ts` and `transferencia-filial-service.ts` into focused EN-named modules under `physical-shipment/`, `branch-transfer/`, and `symbolic-shipment/`, plus rename `cte-remessa-service.ts` — zero fiscal behavior change.

**Architecture:** Domain-folder split mirroring `remessa-fifo/`; move code verbatim then rename symbols; thin PT barrels (`remessa-service.ts`, `transferencia-filial-service.ts`) re-export EN names for one release; public API via `remessas/index.ts` in EN only.

**Tech Stack:** TypeScript, Fastify backend, Prisma, pnpm workspaces, Node test runner (`pnpm test:backend`)

**Spec:** `docs/superpowers/specs/2026-06-20-refactor-onda4-remessa-services-design.md`

---

## Baseline (run once before Task 1)

- [ ] **Step 1: Record baseline**

Run:

```bash
cd /Users/matheus/Documents/msedit-xml
pnpm build
pnpm test:backend
```

Expected: exit 0, **108/108** tests pass.

- [ ] **Step 2: Snapshot grep PT exports (for later comparison)**

Run:

```bash
rg 'emitirRemessaManual|emitirNFeRemessa|emitirRemessaComItens|RemessaError|emitirTransferenciaFilial|TransferenciaFilialError|emitirCteRemessa|prepararRemessaSimbolicaFiscal|RemessaSimbolicaFiscalError' backend/src --glob '*.ts' -l
```

Save the file list — all must be updated or covered by transit barrels by end of plan.

---

## File map (locked)

| Create | Source (move from) |
|--------|-------------------|
| `physical-shipment/physical-shipment.errors.ts` | `RemessaError` class from `remessa-service.ts:404-409` |
| `physical-shipment/physical-shipment.types.ts` | `EmitirRemessaOptions`, `RemessaManualItemInput`, internal `RemessaLinhaInput` |
| `physical-shipment/physical-shipment-destination.mapper.ts` | `destinoToNfeFields` `remessa-service.ts:386-402` |
| `physical-shipment/physical-shipment-tax-lines.ts` | Loop fase 3 `remessa-service.ts:133-176` → export `buildPhysicalShipmentTaxLines()` |
| `physical-shipment/physical-shipment-core.ts` | `emitirNFeRemessaComItens` body `remessa-service.ts:99-335` → `emitShipmentNfeWithItems()` |
| `physical-shipment/physical-shipment-manual.ts` | `emitirRemessaManual` `remessa-service.ts:347-383` → `emitManualShipment()` |
| `physical-shipment/index.ts` | `emitShipmentNfe`, `emitShipmentWithItems`, re-exports types/errors |
| `branch-transfer/branch-transfer.errors.ts` | `TransferenciaFilialError` |
| `branch-transfer/branch-transfer.types.ts` | `TransferenciaFilialItemInput`, internal `BranchTransferLineInput` |
| `branch-transfer/branch-transfer.validation.ts` | `carregarFilial`, `resolverCdPadraoFilial`, `validarRegraProduto`, `validarMatrizDistintaDaFilialDestino`, `validarPreRequisitos` |
| `branch-transfer/branch-transfer-emission.ts` | `emitirNFeTransferenciaComItens`, `buildEmitenteOverride` |
| `branch-transfer/index.ts` | `emitBranchTransfer()` |
| `symbolic-shipment/symbolic-shipment.errors.ts` | `RemessaSimbolicaFiscalError` → `SymbolicShipmentFiscalError` |
| `symbolic-shipment/symbolic-shipment.types.ts` | renamed types from `remessa-simbolica-fiscal.ts` |
| `symbolic-shipment/symbolic-shipment-fiscal.ts` | `prepararRemessaSimbolicaFiscal` → `prepareSymbolicShipmentFiscal` |
| `symbolic-shipment/index.ts` | public re-exports |
| `shipment-cte.service.ts` | move/rename from `cte-remessa-service.ts` |

| Modify | Action |
|--------|--------|
| `remessa-service.ts` | Replace body with barrel → `physical-shipment/` |
| `transferencia-filial-service.ts` | Replace body with barrel → `branch-transfer/` |
| `remessas/index.ts` | EN exports only |
| Call sites (7 files per spec) | Update imports + `instanceof` checks |

| Delete (after Task 3) | Reason |
|-----------------------|--------|
| `cte-remessa-service.ts` | Replaced by `shipment-cte.service.ts` |
| `remessa-simbolica-fiscal.ts` | Replaced by `symbolic-shipment/` |

---

### Task 1: Physical shipment split + EN rename

**Files:**
- Create: `backend/src/modules/remessas/infrastructure/fiscal/physical-shipment/*.ts` (7 files)
- Modify: `backend/src/modules/remessas/infrastructure/fiscal/remessa-service.ts`
- Modify: `backend/src/modules/remessas/infrastructure/factory/remessas-module.factory.ts`
- Modify: `backend/src/modules/remessas/index.ts` (partial — physical exports only)

- [ ] **Step 1: Create `physical-shipment.errors.ts`**

```typescript
/** Domain error for physical shipment (remessa física ML). */
export class ShipmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShipmentError";
  }
}
```

- [ ] **Step 2: Create `physical-shipment.types.ts`**

Move types from `remessa-service.ts` with EN names:

```typescript
import type { EmitenteEmissaoOverride } from "../../../../org/index.js";
import type { Product } from "../../../../generated/prisma/client.js";

export type EmitShipmentOptions = {
  unidadeDestinoId?: string;
  pedidoMl?: string;
  observacaoAvanco?: string;
  emitenteOverride?: EmitenteEmissaoOverride;
  nfeReferenciaId?: string;
};

export type ManualShipmentItemInput = {
  productId: string;
  productSku?: string;
  quantidade: number;
};

export type PhysicalShipmentLineInput = {
  product: Product;
  quantidade: number;
};
```

- [ ] **Step 3: Create `physical-shipment-destination.mapper.ts`**

Move `destinoToNfeFields` unchanged; rename export to `mapShipmentDestinationToNfeFields`.

- [ ] **Step 4: Create `physical-shipment-tax-lines.ts`**

Extract the per-item loop (fase 3) into:

```typescript
export async function buildPhysicalShipmentTaxLines(
  db: DbClient,
  tenantId: string,
  emitUf: string,
  destUf: string,
  linhas: PhysicalShipmentLineInput[],
): Promise<{ line: OrderLine; rule: ResolvedTaxRule }[]>
```

Replace `RemessaError` throws with `ShipmentError`. Import `resolveRemessaCfop` from `../helpers/remessa-dest.js`.

- [ ] **Step 5: Create `physical-shipment-core.ts`**

Move `emitirNFeRemessaComItens` → `emitShipmentNfeWithItems`. Keep logic identical; use extracted tax-lines helper and destination mapper. Import `emitShipmentCte` from `../shipment-cte.service.js` (Task 3 adds file — temporarily keep `cte-remessa-service.js` import until Task 3).

- [ ] **Step 6: Create `physical-shipment-manual.ts`**

Move `emitirRemessaManual` → `emitManualShipment`; replace `RemessaError` with `ShipmentError`.

- [ ] **Step 7: Create `physical-shipment/index.ts`**

```typescript
export { ShipmentError } from "./physical-shipment.errors.js";
export type {
  EmitShipmentOptions,
  ManualShipmentItemInput,
} from "./physical-shipment.types.js";
export { emitManualShipment } from "./physical-shipment-manual.js";
export { emitShipmentNfeWithItems } from "./physical-shipment-core.js";

export async function emitShipmentNfe(/* same signature as emitirNFeRemessa */) { ... }
export async function emitShipmentWithItems(/* same as emitirRemessaComItens */) { ... }
```

- [ ] **Step 8: Replace `remessa-service.ts` with transit barrel**

```typescript
/** @deprecated Import from `./physical-shipment/index.js` */
export {
  ShipmentError as RemessaError,
  emitManualShipment as emitirRemessaManual,
  emitShipmentNfe as emitirNFeRemessa,
  emitShipmentWithItems as emitirRemessaComItens,
  type EmitShipmentOptions as EmitirRemessaOptions,
  type ManualShipmentItemInput as RemessaManualItemInput,
} from "./physical-shipment/index.js";
export { EmitenteFiscalConfigError } from "../../../org/index.js";
```

- [ ] **Step 9: Update `remessas-module.factory.ts`**

```typescript
import { emitManualShipment } from "../fiscal/physical-shipment/index.js";
// ...
return emitManualShipment(getDbClient(), { ... });
```

- [ ] **Step 10: Update `remessas/index.ts` (physical exports)**

```typescript
export {
  emitShipmentNfe,
  emitManualShipment,
  ShipmentError,
  type EmitShipmentOptions,
} from "./infrastructure/fiscal/physical-shipment/index.js";
```

Keep old PT names **removed** from index (EN only per spec).

- [ ] **Step 11: Verify Task 1**

Run:

```bash
pnpm build
pnpm test:backend
rg 'emitirRemessaManual|RemessaError' backend/src/modules/remessas/index.ts
```

Expected: build 0, 108/108 pass; index has no PT symbol names.

- [ ] **Step 12: Commit Task 1** *(requires user authorization)*

```bash
git add backend/src/modules/remessas/infrastructure/fiscal/physical-shipment/
git add backend/src/modules/remessas/infrastructure/fiscal/remessa-service.ts
git add backend/src/modules/remessas/infrastructure/factory/remessas-module.factory.ts
git add backend/src/modules/remessas/index.ts
git commit -m "$(cat <<'EOF'
refactor(remessas): split physical-shipment with EN exports

Extract remessa física orchestration into focused modules and expose
English names from remessas/index.ts while keeping a PT transit barrel.

EOF
)"
```

---

### Task 2: Branch transfer split + EN rename

**Files:**
- Create: `backend/src/modules/remessas/infrastructure/fiscal/branch-transfer/*.ts` (5 files)
- Modify: `transferencia-filial-service.ts`
- Modify: `backend/src/modules/logistics/presentation/controllers/movement.controller.ts`
- Modify: `backend/src/modules/remessas/index.ts`

- [ ] **Step 1: Create `branch-transfer.errors.ts`**

`BranchTransferError` — same messages, EN class name.

- [ ] **Step 2: Create `branch-transfer.types.ts`**

`BranchTransferItemInput` + internal `BranchTransferLineInput`.

- [ ] **Step 3: Create `branch-transfer.validation.ts`**

Move validation helpers unchanged; replace `TransferenciaFilialError` → `BranchTransferError`.

- [ ] **Step 4: Create `branch-transfer-emission.ts`**

Move `emitirNFeTransferenciaComItens` → `emitBranchTransferNfeWithItems`, `buildEmitenteOverride` unchanged.

- [ ] **Step 5: Create `branch-transfer/index.ts`**

Move `emitirTransferenciaFilial` → `emitBranchTransfer`. Import `emitShipmentWithItems` from `../physical-shipment/index.js` (not PT barrel).

- [ ] **Step 6: Replace `transferencia-filial-service.ts` with transit barrel**

Re-export EN symbols with PT aliases (mirror Task 1 pattern).

- [ ] **Step 7: Update `movement.controller.ts`**

```typescript
import {
  BranchTransferError,
  emitBranchTransfer,
} from "../../../remessas/infrastructure/fiscal/branch-transfer/index.js";
import { ShipmentError } from "../../../remessas/infrastructure/fiscal/physical-shipment/index.js";
// instanceof ShipmentError | SymbolicShipmentFiscalError (Task 3)
// instanceof BranchTransferError | EmitenteFiscalConfigError
```

- [ ] **Step 8: Update `remessas/index.ts`**

```typescript
export {
  emitBranchTransfer,
  BranchTransferError,
  type BranchTransferItemInput,
} from "./infrastructure/fiscal/branch-transfer/index.js";
export { ShipmentError } from "./infrastructure/fiscal/physical-shipment/index.js";
```

- [ ] **Step 9: Verify Task 2**

```bash
pnpm build
pnpm test:backend
rg 'emitirTransferenciaFilial|TransferenciaFilialError' backend/src/modules/remessas/index.ts
```

Expected: 0 PT names in index; 108/108 pass.

- [ ] **Step 10: Commit Task 2** *(requires user authorization)*

```bash
git commit -m "$(cat <<'EOF'
refactor(remessas): split branch-transfer with EN exports

Extract filial transfer orchestration and wire movement controller to
English error types and emitBranchTransfer entry point.

EOF
)"
```

---

### Task 3: Symbolic shipment + shipment CTe

**Files:**
- Create: `symbolic-shipment/*.ts` (4 files)
- Create: `shipment-cte.service.ts`
- Delete: `remessa-simbolica-fiscal.ts`, `cte-remessa-service.ts`
- Modify: `physical-shipment-core.ts` (switch CTe import)
- Modify: `fiscal-emissor-adapter.ts`, `prisma-document-return.repository.ts`, `emitir-avanco-mercadoria.ts`
- Modify: `remessa-simbolica-fiscal.test.ts` → move to `symbolic-shipment/symbolic-shipment-fiscal.test.ts`
- Modify: `remessas/index.ts` (final EN exports)

- [ ] **Step 1: Create `shipment-cte.service.ts`**

Copy `cte-remessa-service.ts`; rename export:

```typescript
export async function emitShipmentCte(prisma: PrismaTx, tenant: Tenant, nfeRemessa: NFe) { ... }
```

- [ ] **Step 2: Create `symbolic-shipment/` modules**

Move `remessa-simbolica-fiscal.ts` content with EN renames per spec table. Keep user-facing error strings in PT.

- [ ] **Step 3: Update consumers**

| File | Change |
|------|--------|
| `physical-shipment-core.ts` | `import { emitShipmentCte } from "../shipment-cte.service.js"` |
| `fiscal-emissor-adapter.ts` | `prepareSymbolicShipmentFiscal`, `SymbolicShipmentFiscalError` |
| `prisma-document-return.repository.ts` | same |
| `emitir-avanco-mercadoria.ts` | `emitShipmentCte` |

- [ ] **Step 4: Move and update test file**

Rename imports in test:

```typescript
import { prepareSymbolicShipmentFiscal } from "./symbolic-shipment-fiscal.js";
describe("prepareSymbolicShipmentFiscal — CFOP", () => { ... });
```

- [ ] **Step 5: Finalize `remessas/index.ts`**

```typescript
export {
  prepareSymbolicShipmentFiscal,
  SymbolicShipmentFiscalError,
  type SymbolicShipmentFiscalPrepared,
} from "./infrastructure/fiscal/symbolic-shipment/index.js";
export { emitShipmentCte } from "./infrastructure/fiscal/shipment-cte.service.js";
```

- [ ] **Step 6: Delete obsolete files**

```bash
rm backend/src/modules/remessas/infrastructure/fiscal/cte-remessa-service.ts
rm backend/src/modules/remessas/infrastructure/fiscal/remessa-simbolica-fiscal.ts
rm backend/src/modules/remessas/infrastructure/fiscal/remessa-simbolica-fiscal.test.ts
```

- [ ] **Step 7: Final verification**

```bash
pnpm build
pnpm test:backend
rg 'emitirRemessaManual|emitirNFeRemessa|emitirRemessaComItens|emitirTransferenciaFilial|emitirCteRemessa|prepararRemessaSimbolicaFiscal|RemessaSimbolicaFiscalError|RemessaError|TransferenciaFilialError' backend/src --glob '*.ts'
```

Expected: matches only in transit barrels `remessa-service.ts` and `transferencia-filial-service.ts` (PT alias re-exports). No matches elsewhere.

- [ ] **Step 8: Commit Task 3** *(requires user authorization)*

```bash
git commit -m "$(cat <<'EOF'
refactor(remessas): rename symbolic-shipment and shipment-cte services

Move symbolic fiscal prep and CTe emission to EN-named modules and
remove legacy monolith files.

EOF
)"
```

---

## Post-plan checklist

- [ ] Update spec status to **Concluída** in `2026-06-20-refactor-onda4-remessa-services-design.md`
- [ ] Update `2026-06-20-refactor-quick-wins-design.md` Onda 4 row with commit SHAs
- [ ] Do **not** rename frontend `fiscal-api` (Onda 6)

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| Split physical-shipment | Task 1 |
| Split branch-transfer | Task 2 |
| Symbolic + CTe | Task 3 |
| EN rename table | All tasks |
| PT transit barrels | Tasks 1–2 |
| Call sites (7 files) | Tasks 1–3 |
| Frontend unchanged | Post-plan note |
| build + 108 tests | Every task verify step |
| No pipeline extraction | Out of scope |
| Commit only after user OK | Noted on each commit step |

No placeholders. Type names consistent across tasks.
