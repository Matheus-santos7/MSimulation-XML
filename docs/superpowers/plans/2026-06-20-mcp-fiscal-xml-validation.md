# MCP Fiscal XML Validation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Intercept every generated NF-e XML at `persistNfeXmlAutorizado`, validate via `mcp-fiscal-brasil` REST API, persist validation audit fields on `nfes`, and surface status/errors in NF-e UI and IA Insights page.

**Architecture:** Single integration choke point in `nfe-xml-service.ts` (all emission paths already call it). Domain port `FiscalValidatorPort` + HTTP adapter mirroring `HttpCepLookupGateway`. Prisma adds `NfeValidationStatus` + three columns on `NFe`. Frontend consumes extended `NFeDto` and new insights endpoint — no fiscal logic in browser.

**Tech Stack:** TypeScript, Fastify, Prisma 7, Docker Compose, Next.js App Router, Node test runner (`pnpm test:backend`), `mcp-fiscal-brasil` Docker image

**Spec:** `docs/superpowers/specs/2026-06-20-mcp-fiscal-xml-validation-design.md`

---

## File map (locked)

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `docker-compose.yml` (modify) | `fiscal-validator-api` service |
| Modify | `.env.example`, `backend/.env.example` | `FISCAL_VALIDATOR_*` vars |
| Modify | `backend/prisma/schema.prisma` | enum + 3 NFe columns |
| Create | `backend/prisma/migrations/..._add_nfe_validation_tracking/` | migration SQL |
| Create | `backend/src/modules/fiscal-documents/domain/ports/fiscal-validator.port.ts` | contract |
| Create | `backend/src/modules/fiscal-documents/infrastructure/external/http-fiscal-validator.adapter.ts` | HTTP client |
| Create | `backend/src/modules/fiscal-documents/infrastructure/external/fake-fiscal-validator.adapter.ts` | tests |
| Create | `backend/src/modules/fiscal-documents/infrastructure/external/http-fiscal-validator.adapter.test.ts` | adapter unit tests |
| Create | `backend/src/lib/fiscal-validator-config.ts` | env parsing |
| Create | `backend/src/lib/fiscal-validator-factory.ts` | compose adapter from env |
| Modify | `backend/src/modules/fiscal-documents/infrastructure/xml/nfe-xml-service.ts` | validate + persist fields |
| Create | `backend/src/modules/fiscal-documents/infrastructure/xml/nfe-xml-validation.test.ts` | persist integration test |
| Modify | `backend/src/modules/fiscal-documents/presentation/mappers/fiscal-mappers.ts` | map validation fields |
| Modify | `backend/src/modules/fiscal-documents/infrastructure/prisma/prisma-nfe-query.repository.ts` | select new columns |
| Create | `backend/src/modules/fiscal-documents/application/use-cases/get-validation-insights.use-case.ts` | IA aggregates |
| Create | `backend/src/modules/fiscal-documents/infrastructure/prisma/prisma-validation-insights.repository.ts` | Prisma queries |
| Modify | `backend/src/modules/fiscal-documents/presentation/controllers/fiscal-observability.controller.ts` | `GET /fiscal-validation/insights` |
| Modify | `backend/src/modules/fiscal-documents/infrastructure/factory/fiscal-documents-module.factory.ts` | wire use case |
| Modify | `backend/src/modules/fiscal-documents/index.ts` | export port types if needed |
| Modify | `frontend/src/lib/fiscal-types.ts` | `NFeDto` validation fields |
| Create | `frontend/src/lib/fiscal-api/validation-insights.ts` | API client |
| Modify | `frontend/src/lib/fiscal-api/index.ts` | re-export |
| Create | `frontend/src/components/nfe-validation-badge.tsx` | badge UI |
| Modify | `frontend/src/app/(app)/nfe/page.tsx` | column badge |
| Modify | `frontend/src/app/(app)/nfe/[chave]/page.tsx` | error panel |
| Modify | `frontend/src/app/(app)/ia/page.tsx` | real insights |
| Create | `frontend/src/components/fiscal-validation-insights.tsx` | client list component |

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

- [ ] **Step 2: Confirm integration choke point**

Run:

```bash
rg 'persistNfeXmlAutorizado|persistNfeXmlFromEmission' backend/src --glob '*.ts' -l
```

Expected files include: `nfe-xml-service.ts`, `physical-shipment-core.ts`, `branch-transfer-emission.ts`, `emit-sale-note.ts`, `emit-return-note.ts`, `prisma-document-return.repository.ts`, `nfe-xml-persist.ts`.

---

### Task 1: Docker Compose + environment

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `backend/.env.example`

- [ ] **Step 1: Add validator service to docker-compose.yml**

Append after `postgres` service:

```yaml
  fiscal-validator-api:
    image: ghcr.io/dehor-labs/mcp-fiscal-brasil:latest
    container_name: msimulation-xml-fiscal-validator
    restart: unless-stopped
    ports:
      - "${FISCAL_VALIDATOR_PORT:-8080}:8000"
    environment:
      MCP_FISCAL_LOG_LEVEL: INFO
    command: ["mcp-fiscal-api"]
    depends_on:
      postgres:
        condition: service_healthy
```

- [ ] **Step 2: Document env vars**

Add to `backend/.env.example`:

```bash
# --- Validador MCP Fiscal (opcional em dev) ------------------------------------
# Requer: pnpm docker:up (serviço fiscal-validator-api)
FISCAL_VALIDATOR_URL=http://localhost:8080
FISCAL_VALIDATOR_ENABLED=true
```

Add to root `.env.example`:

```bash
FISCAL_VALIDATOR_PORT=8080
```

- [ ] **Step 3: Smoke test container (manual, optional)**

Run:

```bash
pnpm docker:up
curl -sf -X POST http://localhost:8080/api/v1/validate-nfe \
  -H 'Content-Type: application/json' \
  -d '{"xml":"<nfeProc/>"}' | head -c 200
```

Expected: JSON response (may be `valida: false` for dummy XML — confirms reachability).

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .env.example backend/.env.example
git commit -m "chore(infra): add mcp-fiscal-brasil validator to docker compose"
```

---

### Task 2: Prisma schema + migration

**Files:**
- Modify: `backend/prisma/schema.prisma` (model `NFe`, ~line 382)
- Create: migration via Prisma CLI

- [ ] **Step 1: Add enum and fields to schema**

Insert enum before `model NFe`:

```prisma
enum NfeValidationStatus {
  PENDING
  APPROVED
  REJECTED
}
```

Inside `model NFe`, after `xmlAutorizado`:

```prisma
  statusValidacao   NfeValidationStatus @default(PENDING) @map("status_validacao")
  mensagemValidacao String?             @map("mensagem_validacao")
  errosValidacao    Json?               @map("erros_validacao")
```

- [ ] **Step 2: Create migration**

Run:

```bash
cd /Users/matheus/Documents/msedit-xml/backend
pnpm exec prisma migrate dev --name add_nfe_validation_tracking
pnpm exec prisma generate
```

Expected: new folder `backend/prisma/migrations/*_add_nfe_validation_tracking/migration.sql` with `CREATE TYPE` + `ALTER TABLE nfes ADD COLUMN ...`.

- [ ] **Step 3: Verify build**

Run:

```bash
cd /Users/matheus/Documents/msedit-xml
pnpm build
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/generated
git commit -m "feat(db): add NFe validation tracking columns"
```

---

### Task 3: Domain port + config + factory

**Files:**
- Create: `backend/src/modules/fiscal-documents/domain/ports/fiscal-validator.port.ts`
- Create: `backend/src/lib/fiscal-validator-config.ts`
- Create: `backend/src/lib/fiscal-validator-factory.ts`

- [ ] **Step 1: Create port**

```typescript
// backend/src/modules/fiscal-documents/domain/ports/fiscal-validator.port.ts

/** Result of MCP NF-e XML validation. */
export type NfeValidationResult = {
  isValid: boolean;
  message: string;
  errors: string[];
};

/** Outbound port — validate NF-e XML via external MCP service. */
export interface FiscalValidatorPort {
  validateNfe(xmlContent: string): Promise<NfeValidationResult>;
}
```

- [ ] **Step 2: Create config helper**

```typescript
// backend/src/lib/fiscal-validator-config.ts

export type FiscalValidatorConfig = {
  enabled: boolean;
  apiUrl: string;
};

export function loadFiscalValidatorConfig(): FiscalValidatorConfig {
  const enabledRaw = process.env.FISCAL_VALIDATOR_ENABLED?.trim().toLowerCase();
  const enabled = enabledRaw !== "false" && enabledRaw !== "0";
  const apiUrl = (process.env.FISCAL_VALIDATOR_URL ?? "http://localhost:8080").replace(/\/$/, "");
  return { enabled, apiUrl };
}
```

- [ ] **Step 3: Create factory**

```typescript
// backend/src/lib/fiscal-validator-factory.ts

import type { FiscalValidatorPort } from "../modules/fiscal-documents/domain/ports/fiscal-validator.port.js";
import { HttpFiscalValidatorAdapter } from "../modules/fiscal-documents/infrastructure/external/http-fiscal-validator.adapter.js";
import { loadFiscalValidatorConfig } from "./fiscal-validator-config.js";

let cached: FiscalValidatorPort | null = null;

export function getFiscalValidator(): FiscalValidatorPort {
  if (!cached) {
    const { apiUrl } = loadFiscalValidatorConfig();
    cached = new HttpFiscalValidatorAdapter(apiUrl);
  }
  return cached;
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/fiscal-documents/domain/ports/fiscal-validator.port.ts \
  backend/src/lib/fiscal-validator-config.ts \
  backend/src/lib/fiscal-validator-factory.ts
git commit -m "feat(fiscal-documents): add FiscalValidatorPort and config"
```

---

### Task 4: HTTP adapter + unit tests

**Files:**
- Create: `backend/src/modules/fiscal-documents/infrastructure/external/http-fiscal-validator.adapter.ts`
- Create: `backend/src/modules/fiscal-documents/infrastructure/external/fake-fiscal-validator.adapter.ts`
- Create: `backend/src/modules/fiscal-documents/infrastructure/external/http-fiscal-validator.adapter.test.ts`
- Modify: `backend/package.json` (add test file to script if needed)

- [ ] **Step 1: Write failing adapter test**

```typescript
// backend/src/modules/fiscal-documents/infrastructure/external/http-fiscal-validator.adapter.test.ts

import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { HttpFiscalValidatorAdapter } from "./http-fiscal-validator.adapter.js";

describe("HttpFiscalValidatorAdapter", () => {
  it("maps valida=true to approved result", async () => {
    const fetchMock = mock.fn(async () =>
      new Response(JSON.stringify({ valida: true, erros: [] }), { status: 200 }),
    );
    const adapter = new HttpFiscalValidatorAdapter("http://validator.test", fetchMock as typeof fetch);

    const result = await adapter.validateNfe("<nfeProc/>");

    assert.equal(result.isValid, true);
    assert.equal(result.message, "XML aprovado");
    assert.deepEqual(result.errors, []);
    assert.equal(fetchMock.mock.calls.length, 1);
  });

  it("maps valida=false to rejected result with errors", async () => {
    const fetchMock = mock.fn(async () =>
      new Response(JSON.stringify({ valida: false, erros: ["CFOP inválido"] }), { status: 200 }),
    );
    const adapter = new HttpFiscalValidatorAdapter("http://validator.test", fetchMock as typeof fetch);

    const result = await adapter.validateNfe("<nfeProc/>");

    assert.equal(result.isValid, false);
    assert.match(result.message, /erros estruturais/i);
    assert.deepEqual(result.errors, ["CFOP inválido"]);
  });

  it("throws when HTTP status is not ok", async () => {
    const fetchMock = mock.fn(async () => new Response("down", { status: 503 }));
    const adapter = new HttpFiscalValidatorAdapter("http://validator.test", fetchMock as typeof fetch);

    await assert.rejects(
      () => adapter.validateNfe("<nfeProc/>"),
      /microsserviço de validação/i,
    );
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run:

```bash
cd /Users/matheus/Documents/msedit-xml/backend
node --import tsx --test src/modules/fiscal-documents/infrastructure/external/http-fiscal-validator.adapter.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement HTTP adapter**

```typescript
// backend/src/modules/fiscal-documents/infrastructure/external/http-fiscal-validator.adapter.ts

import type {
  FiscalValidatorPort,
  NfeValidationResult,
} from "../../domain/ports/fiscal-validator.port.js";

type McpValidateNfeResponse = {
  valida?: boolean;
  erros?: string[];
};

const REJECTED_MESSAGE =
  "Foram encontrados erros estruturais/fiscais no XML.";

/**
 * HTTP adapter for mcp-fiscal-brasil `POST /api/v1/validate-nfe`.
 */
export class HttpFiscalValidatorAdapter implements FiscalValidatorPort {
  constructor(
    private readonly apiUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async validateNfe(xmlContent: string): Promise<NfeValidationResult> {
    const response = await this.fetchImpl(`${this.apiUrl}/api/v1/validate-nfe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ xml: xmlContent }),
    });

    if (!response.ok) {
      throw new Error("Falha na comunicação com o microsserviço de validação.");
    }

    const data = (await response.json()) as McpValidateNfeResponse;
    const isValid = Boolean(data.valida);

    return {
      isValid,
      message: isValid ? "XML aprovado" : REJECTED_MESSAGE,
      errors: Array.isArray(data.erros) ? data.erros.map(String) : [],
    };
  }
}
```

- [ ] **Step 4: Implement fake adapter for later tests**

```typescript
// backend/src/modules/fiscal-documents/infrastructure/external/fake-fiscal-validator.adapter.ts

import type {
  FiscalValidatorPort,
  NfeValidationResult,
} from "../../domain/ports/fiscal-validator.port.js";

export class FakeFiscalValidatorAdapter implements FiscalValidatorPort {
  constructor(private readonly result: NfeValidationResult) {}

  async validateNfe(_xmlContent: string): Promise<NfeValidationResult> {
    return this.result;
  }
}
```

- [ ] **Step 5: Run tests — expect PASS**

Run:

```bash
cd /Users/matheus/Documents/msedit-xml/backend
node --import tsx --test src/modules/fiscal-documents/infrastructure/external/http-fiscal-validator.adapter.test.ts
```

Expected: 3/3 pass.

- [ ] **Step 6: Add test to backend test script**

In `backend/package.json`, append `src/modules/fiscal-documents/infrastructure/external/http-fiscal-validator.adapter.test.ts` to the existing `test:backend` node --test file list (same pattern as other module tests).

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/fiscal-documents/infrastructure/external/ backend/package.json
git commit -m "feat(fiscal-documents): add HTTP fiscal validator adapter"
```

---

### Task 5: Integrate validation in `persistNfeXmlAutorizado`

**Files:**
- Modify: `backend/src/modules/fiscal-documents/infrastructure/xml/nfe-xml-service.ts`
- Create: `backend/src/modules/fiscal-documents/infrastructure/xml/nfe-xml-validation.test.ts`

- [ ] **Step 1: Write failing integration test**

```typescript
// backend/src/modules/fiscal-documents/infrastructure/xml/nfe-xml-validation.test.ts

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NfeValidationStatus } from "../../../../generated/prisma/client.js";
import { FakeFiscalValidatorAdapter } from "../external/fake-fiscal-validator.adapter.js";
import { resolveNfeValidationUpdate } from "./nfe-xml-validation.js";

describe("resolveNfeValidationUpdate", () => {
  it("returns APPROVED when validator approves", async () => {
    const validator = new FakeFiscalValidatorAdapter({
      isValid: true,
      message: "XML aprovado",
      errors: [],
    });

    const update = await resolveNfeValidationUpdate(validator, "<xml/>", { enabled: true });

    assert.equal(update.statusValidacao, NfeValidationStatus.APPROVED);
    assert.equal(update.mensagemValidacao, "XML aprovado");
    assert.equal(update.errosValidacao, null);
  });

  it("returns REJECTED but keeps xml when validator rejects", async () => {
    const validator = new FakeFiscalValidatorAdapter({
      isValid: false,
      message: "Foram encontrados erros estruturais/fiscais no XML.",
      errors: ["CST 00 exige vBC"],
    });

    const update = await resolveNfeValidationUpdate(validator, "<xml/>", { enabled: true });

    assert.equal(update.statusValidacao, NfeValidationStatus.REJECTED);
    assert.deepEqual(update.errosValidacao, ["CST 00 exige vBC"]);
  });

  it("returns PENDING when validator is disabled", async () => {
    const validator = new FakeFiscalValidatorAdapter({
      isValid: true,
      message: "unused",
      errors: [],
    });

    const update = await resolveNfeValidationUpdate(validator, "<xml/>", { enabled: false });

    assert.equal(update.statusValidacao, NfeValidationStatus.PENDING);
    assert.match(update.mensagemValidacao ?? "", /desabilitada/i);
  });

  it("returns PENDING when validator HTTP throws", async () => {
    const validator: import("../../domain/ports/fiscal-validator.port.js").FiscalValidatorPort = {
      async validateNfe() {
        throw new Error("connection refused");
      },
    };

    const update = await resolveNfeValidationUpdate(validator, "<xml/>", { enabled: true });

    assert.equal(update.statusValidacao, NfeValidationStatus.PENDING);
    assert.match(update.mensagemValidacao ?? "", /indisponível/i);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run:

```bash
cd /Users/matheus/Documents/msedit-xml/backend
node --import tsx --test src/modules/fiscal-documents/infrastructure/xml/nfe-xml-validation.test.ts
```

Expected: FAIL — `resolveNfeValidationUpdate` not found.

- [ ] **Step 3: Extract pure helper + wire persist**

Create `backend/src/modules/fiscal-documents/infrastructure/xml/nfe-xml-validation.ts`:

```typescript
import { NfeValidationStatus, type Prisma } from "../../../../generated/prisma/client.js";
import type { FiscalValidatorPort } from "../../domain/ports/fiscal-validator.port.js";

type ValidationConfig = { enabled: boolean };

export async function resolveNfeValidationUpdate(
  validator: FiscalValidatorPort,
  xml: string,
  config: ValidationConfig,
): Promise<Pick<Prisma.NFeUpdateInput, "statusValidacao" | "mensagemValidacao" | "errosValidacao">> {
  if (!config.enabled) {
    return {
      statusValidacao: NfeValidationStatus.PENDING,
      mensagemValidacao: "Validação desabilitada",
      errosValidacao: null,
    };
  }

  try {
    const result = await validator.validateNfe(xml);
    return {
      statusValidacao: result.isValid ? NfeValidationStatus.APPROVED : NfeValidationStatus.REJECTED,
      mensagemValidacao: result.message,
      errosValidacao: result.errors.length > 0 ? result.errors : null,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido";
    return {
      statusValidacao: NfeValidationStatus.PENDING,
      mensagemValidacao: `Validador indisponível: ${detail}`,
      errosValidacao: null,
    };
  }
}
```

Modify `persistNfeXmlAutorizado` in `nfe-xml-service.ts`:

```typescript
import { getFiscalValidator } from "../../../../lib/fiscal-validator-factory.js";
import { loadFiscalValidatorConfig } from "../../../../lib/fiscal-validator-config.js";
import { resolveNfeValidationUpdate } from "./nfe-xml-validation.js";

// inside persistNfeXmlAutorizado, replace the tx.nFe.update block:

  const xml = buildNfeXmlAutorizado(
    dto,
    args.tenant,
    primaryProduct,
    args.settings,
    allProducts,
  );

  const validationUpdate = await resolveNfeValidationUpdate(
    getFiscalValidator(),
    xml,
    loadFiscalValidatorConfig(),
  );

  await tx.nFe.update({
    where: { id: args.nfeId },
    data: {
      xmlAutorizado: xml,
      ...validationUpdate,
    },
  });
```

- [ ] **Step 4: Run tests — expect PASS**

Run:

```bash
cd /Users/matheus/Documents/msedit-xml
pnpm test:backend
```

Expected: all prior tests + new validation tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/fiscal-documents/infrastructure/xml/nfe-xml-service.ts \
  backend/src/modules/fiscal-documents/infrastructure/xml/nfe-xml-validation.ts \
  backend/src/modules/fiscal-documents/infrastructure/xml/nfe-xml-validation.test.ts \
  backend/package.json
git commit -m "feat(fiscal-documents): validate NF-e XML via MCP on persist"
```

---

### Task 6: Expose validation fields in API (DTO + mapper)

**Files:**
- Modify: `backend/src/modules/fiscal-documents/presentation/mappers/fiscal-mappers.ts`
- Modify: `backend/src/modules/fiscal-documents/infrastructure/prisma/prisma-nfe-query.repository.ts`
- Modify: `frontend/src/lib/fiscal-types.ts`

- [ ] **Step 1: Extend NfeRow type and mapNfe return**

In `fiscal-mappers.ts`, add to `NfeRow`:

```typescript
  statusValidacao?: import("../../../../generated/prisma/client.js").NfeValidationStatus;
  mensagemValidacao?: string | null;
  errosValidacao?: unknown;
```

In `mapNfe` return object:

```typescript
    validationStatus: row.statusValidacao ?? "PENDING",
    validationMessage: row.mensagemValidacao ?? undefined,
    validationErrors: Array.isArray(row.errosValidacao)
      ? (row.errosValidacao as string[])
      : undefined,
```

- [ ] **Step 2: Ensure Prisma queries include columns**

Verify `prisma-nfe-query.repository.ts` uses `findMany` / `findFirst` without restrictive `select` that omits new fields (default includes all scalar columns). If any explicit `select` exists, add the three fields.

- [ ] **Step 3: Extend frontend type**

In `frontend/src/lib/fiscal-types.ts`, add to `NFeDto`:

```typescript
  validationStatus: "PENDING" | "APPROVED" | "REJECTED";
  validationMessage?: string;
  validationErrors?: string[];
```

- [ ] **Step 4: Verify build**

Run:

```bash
cd /Users/matheus/Documents/msedit-xml
pnpm build
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/fiscal-documents/presentation/mappers/fiscal-mappers.ts \
  backend/src/modules/fiscal-documents/infrastructure/prisma/prisma-nfe-query.repository.ts \
  frontend/src/lib/fiscal-types.ts
git commit -m "feat(api): expose NFe validation status in DTO"
```

---

### Task 7: Validation insights endpoint (backend)

**Files:**
- Create: `backend/src/modules/fiscal-documents/application/use-cases/get-validation-insights.use-case.ts`
- Create: `backend/src/modules/fiscal-documents/infrastructure/prisma/prisma-validation-insights.repository.ts`
- Modify: `backend/src/modules/fiscal-documents/presentation/controllers/fiscal-observability.controller.ts`
- Modify: `backend/src/modules/fiscal-documents/infrastructure/factory/fiscal-documents-module.factory.ts`

- [ ] **Step 1: Create repository**

```typescript
// backend/src/modules/fiscal-documents/infrastructure/prisma/prisma-validation-insights.repository.ts

import { NfeValidationStatus, type PrismaClient } from "../../../../generated/prisma/client.js";

export type ValidationInsightRow = {
  id: string;
  chave: string;
  numero: number;
  serie: number;
  cfop: string;
  tipo: string;
  mensagemValidacao: string | null;
  errosValidacao: unknown;
  emitidaEm: Date;
};

export async function listRecentRejectedNfes(
  db: PrismaClient,
  tenantId: string,
  days = 7,
  limit = 20,
): Promise<ValidationInsightRow[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return db.nFe.findMany({
    where: {
      tenantId,
      deletedAt: null,
      statusValidacao: NfeValidationStatus.REJECTED,
      emitidaEm: { gte: since },
    },
    orderBy: { emitidaEm: "desc" },
    take: limit,
    select: {
      id: true,
      chave: true,
      numero: true,
      serie: true,
      cfop: true,
      tipo: true,
      mensagemValidacao: true,
      errosValidacao: true,
      emitidaEm: true,
    },
  });
}

export async function countValidationStatuses(
  db: PrismaClient,
  tenantId: string,
  days = 7,
): Promise<{ approved: number; rejected: number; pending: number }> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.nFe.groupBy({
    by: ["statusValidacao"],
    where: { tenantId, deletedAt: null, emitidaEm: { gte: since } },
    _count: { _all: true },
  });
  const map = Object.fromEntries(rows.map((r) => [r.statusValidacao, r._count._all]));
  return {
    approved: map[NfeValidationStatus.APPROVED] ?? 0,
    rejected: map[NfeValidationStatus.REJECTED] ?? 0,
    pending: map[NfeValidationStatus.PENDING] ?? 0,
  };
}
```

- [ ] **Step 2: Create use case**

```typescript
// backend/src/modules/fiscal-documents/application/use-cases/get-validation-insights.use-case.ts

import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import {
  countValidationStatuses,
  listRecentRejectedNfes,
} from "../../infrastructure/prisma/prisma-validation-insights.repository.js";

export class GetValidationInsightsUseCase {
  async execute(db: DbClient, tenantId: string) {
    const [counts, rejected] = await Promise.all([
      countValidationStatuses(db, tenantId, 7),
      listRecentRejectedNfes(db, tenantId, 7, 20),
    ]);

    const errorFrequency = new Map<string, number>();
    for (const row of rejected) {
      const errors = Array.isArray(row.errosValidacao) ? (row.errosValidacao as string[]) : [];
      for (const err of errors) {
        errorFrequency.set(err, (errorFrequency.get(err) ?? 0) + 1);
      }
    }

    const topErrors = [...errorFrequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([message, count]) => ({ message, count }));

    return {
      periodDays: 7,
      counts,
      topErrors,
      recentRejections: rejected.map((row) => ({
        chave: row.chave,
        numero: row.numero,
        serie: row.serie,
        cfop: row.cfop,
        tipo: row.tipo,
        emitidaEm: row.emitidaEm.toISOString(),
        message: row.mensagemValidacao ?? undefined,
        errors: Array.isArray(row.errosValidacao) ? (row.errosValidacao as string[]) : [],
      })),
    };
  }
}
```

- [ ] **Step 3: Register route**

In `fiscal-observability.controller.ts`:

```typescript
import { GetValidationInsightsUseCase } from "../../application/use-cases/get-validation-insights.use-case.js";

const getValidationInsights = new GetValidationInsightsUseCase();

// inside plugin:
  app.get("/fiscal-validation/insights", async (req) => {
    const tenantId = tenantIdFromRequest(req);
    return getValidationInsights.execute(getDbClient(), tenantId);
  });
```

Wire in factory if routes are registered via module (follow existing pattern for controllers — observability controller is standalone plugin; no factory change strictly required unless app registers via factory).

- [ ] **Step 4: Manual API check**

With backend running and at least one REJECTED NFe in DB:

```bash
curl -s -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: $TENANT" \
  http://localhost:3001/api/fiscal-validation/insights | jq .
```

Expected: JSON with `counts`, `topErrors`, `recentRejections`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/fiscal-documents/application/use-cases/get-validation-insights.use-case.ts \
  backend/src/modules/fiscal-documents/infrastructure/prisma/prisma-validation-insights.repository.ts \
  backend/src/modules/fiscal-documents/presentation/controllers/fiscal-observability.controller.ts
git commit -m "feat(fiscal-documents): add validation insights API for IA page"
```

---

### Task 8: Frontend — fiscal-api + NF-e UI badges

**Files:**
- Create: `frontend/src/lib/fiscal-api/validation-insights.ts`
- Modify: `frontend/src/lib/fiscal-api/index.ts`
- Create: `frontend/src/components/nfe-validation-badge.tsx`
- Modify: `frontend/src/app/(app)/nfe/page.tsx`
- Modify: `frontend/src/app/(app)/nfe/[chave]/page.tsx`

- [ ] **Step 1: API client**

```typescript
// frontend/src/lib/fiscal-api/validation-insights.ts

import { buildApiUrl, getJson } from "./client";

export type ValidationInsightsDto = {
  periodDays: number;
  counts: { approved: number; rejected: number; pending: number };
  topErrors: { message: string; count: number }[];
  recentRejections: {
    chave: string;
    numero: number;
    serie: number;
    cfop: string;
    tipo: string;
    emitidaEm: string;
    message?: string;
    errors: string[];
  }[];
};

export async function getValidationInsights(): Promise<ValidationInsightsDto> {
  return getJson<ValidationInsightsDto>(buildApiUrl("/api/fiscal-validation/insights"));
}
```

Export from `frontend/src/lib/fiscal-api/index.ts`.

- [ ] **Step 2: Badge component**

```tsx
// frontend/src/components/nfe-validation-badge.tsx

import type { NFeDto } from "@/lib/fiscal-types";

const LABELS = {
  PENDING: "Validação pendente",
  APPROVED: "XML aprovado",
  REJECTED: "XML rejeitado",
} as const;

const TONES = {
  PENDING: "bg-muted text-muted-foreground border-border",
  APPROVED: "bg-success/10 text-success border-success/30",
  REJECTED: "bg-destructive/10 text-destructive border-destructive/30",
} as const;

export function NfeValidationBadge({ status }: { status: NFeDto["validationStatus"] }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${TONES[status]}`}
      title={LABELS[status]}
    >
      {LABELS[status]}
    </span>
  );
}
```

- [ ] **Step 3: Add column to NF-e list**

In `frontend/src/app/(app)/nfe/page.tsx`:

- Import `NfeValidationBadge`
- Add `<th>Validação</th>` after Status column
- In row render: `<td><NfeValidationBadge status={nfe.validationStatus ?? "PENDING"} /></td>`

- [ ] **Step 4: Detail page error panel**

In `frontend/src/app/(app)/nfe/[chave]/page.tsx`, after header badges:

```tsx
{nfe.validationStatus === "REJECTED" && (
  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 space-y-2">
    <p className="text-sm font-semibold text-destructive">Validação MCP — rejeitado</p>
    {nfe.validationMessage && (
      <p className="text-sm text-muted-foreground">{nfe.validationMessage}</p>
    )}
    {nfe.validationErrors?.length ? (
      <ul className="list-disc pl-5 text-sm text-destructive/90">
        {nfe.validationErrors.map((err) => (
          <li key={err}>{err}</li>
        ))}
      </ul>
    ) : null}
  </div>
)}
```

- [ ] **Step 5: Build**

Run:

```bash
cd /Users/matheus/Documents/msedit-xml
pnpm build
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/fiscal-api/validation-insights.ts frontend/src/lib/fiscal-api/index.ts \
  frontend/src/components/nfe-validation-badge.tsx \
  frontend/src/app/(app)/nfe/page.tsx frontend/src/app/(app)/nfe/[chave]/page.tsx
git commit -m "feat(frontend): show NFe MCP validation status in list and detail"
```

---

### Task 9: Frontend — IA Insights page (real data)

**Files:**
- Create: `frontend/src/components/fiscal-validation-insights.tsx`
- Modify: `frontend/src/app/(app)/ia/page.tsx`

- [ ] **Step 1: Server component fetches insights**

Replace static `INSIGHTS` in `ia/page.tsx`:

```tsx
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { getValidationInsights } from "@/lib/fiscal-api";
import { FiscalValidationInsights } from "@/components/fiscal-validation-insights";

export default async function IaPage() {
  await resolveActiveTenantId();
  const insights = await getValidationInsights();

  return (
    <div className="p-6">
      <PageHeader
        title="IA Fiscal Insights"
        subtitle="Validação MCP, rejeições recentes e padrões de erro (últimos 7 dias)"
        actions={/* keep Sparkles badge, change label to MCP Fiscal */}
      />
      <FiscalValidationInsights data={insights} />
    </div>
  );
}
```

- [ ] **Step 2: Presentational component**

```tsx
// frontend/src/components/fiscal-validation-insights.tsx

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import type { ValidationInsightsDto } from "@/lib/fiscal-api/validation-insights";

export function FiscalValidationInsights({ data }: { data: ValidationInsightsDto }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={CheckCircle2} label="Aprovados" value={data.counts.approved} tone="success" />
        <StatCard icon={AlertTriangle} label="Rejeitados" value={data.counts.rejected} tone="accent" />
        <StatCard icon={Clock} label="Pendentes" value={data.counts.pending} tone="muted" />
      </div>

      {data.topErrors.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Erros mais frequentes
          </h2>
          {data.topErrors.map((item) => (
            <div key={item.message} className="border border-border rounded-lg p-4 bg-card">
              <div className="font-medium">{item.message}</div>
              <div className="text-sm text-muted-foreground mt-1">{item.count} ocorrência(s)</div>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          NF-e rejeitadas recentemente
        </h2>
        {data.recentRejections.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma rejeição nos últimos {data.periodDays} dias.</p>
        ) : (
          data.recentRejections.map((row) => (
            <div key={row.chave} className="border border-destructive/30 bg-destructive/5 rounded-lg p-4 flex gap-4">
              <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-bold">
                  NF-e {row.numero}/{row.serie} · CFOP {row.cfop}
                </div>
                <div className="text-sm text-muted-foreground mt-1 truncate">{row.message}</div>
                {row.errors[0] && (
                  <div className="text-xs text-destructive/90 mt-2">{row.errors[0]}</div>
                )}
              </div>
              <Link
                href={`/nfe/${row.chave}`}
                className="text-xs font-bold uppercase tracking-widest text-accent hover:underline self-start shrink-0"
              >
                Ver NF-e →
              </Link>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: number;
  tone: "success" | "accent" | "muted";
}) {
  const tones = {
    success: "border-success/30 bg-success/5",
    accent: "border-accent/30 bg-accent/5",
    muted: "border-border bg-card",
  };
  return (
    <div className={`border rounded-lg p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-widest">
        <Icon className="size-4" />
        {label}
      </div>
      <div className="text-3xl font-bold mt-2">{value}</div>
    </div>
  );
}
```

- [ ] **Step 3: Build + smoke test IA page**

Run:

```bash
pnpm build
pnpm dev
# Open http://localhost:3000/ia — should show counts (zeros if no rejections)
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/(app)/ia/page.tsx frontend/src/components/fiscal-validation-insights.tsx
git commit -m "feat(frontend): feed IA insights page from MCP validation API"
```

---

### Task 10: Final verification + docs

**Files:**
- Modify: `docs/superpowers/specs/2026-06-20-mcp-fiscal-xml-validation-design.md` (status → Concluída after merge)

- [ ] **Step 1: Full test suite**

Run:

```bash
cd /Users/matheus/Documents/msedit-xml
pnpm build
pnpm test:backend
```

Expected: exit 0.

- [ ] **Step 2: End-to-end manual scenario**

1. `FISCAL_VALIDATOR_ENABLED=true` + Docker validator up
2. Emitir remessa manual ou faturar pedido
3. Verificar NF-e na lista com badge Aprovado ou Rejeitado
4. Abrir `/ia` — contadores atualizados
5. Se rejeitada, detalhe mostra lista de erros MCP

- [ ] **Step 3: Update spec status**

Set `Status: Concluída` in design spec after all tasks pass.

- [ ] **Step 4: Final commit (docs only)**

```bash
git add docs/superpowers/specs/2026-06-20-mcp-fiscal-xml-validation-design.md
git commit -m "docs: mark MCP fiscal validation spec as implemented"
```

---

## Self-review checklist

| Spec requirement | Task |
|------------------|------|
| Docker service `fiscal-validator-api` | Task 1 |
| Prisma `ValidationStatus` + 3 columns | Task 2 |
| `FiscalValidatorPort` | Task 3 |
| `HttpFiscalValidatorAdapter` | Task 4 |
| Hook after XML build, before persist | Task 5 |
| Invalid XML persists REJECTED (no rollback) | Task 5 (`resolveNfeValidationUpdate`) |
| DTO/API exposes validation fields | Task 6 |
| IA page fed by backend | Tasks 7 + 9 |
| NF-e UI shows status | Task 8 |
| CT-e validation | Out of scope (spec §6) |

**Placeholder scan:** No TBD steps. All code blocks are complete.

**Type consistency:** `validationStatus` uses `PENDING|APPROVED|REJECTED` in Prisma enum, mapper, and frontend type throughout.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-20-mcp-fiscal-xml-validation.md`. Design spec saved to `docs/superpowers/specs/2026-06-20-mcp-fiscal-xml-validation-design.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
