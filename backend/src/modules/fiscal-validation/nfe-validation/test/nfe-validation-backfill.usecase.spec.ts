import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";
import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import type { FiscalValidatorProvider } from "../../providers/fiscal-validator/fiscal-validator.provider.js";
import type { NfeXmlContentResolver } from "../types/nfe-xml-content-resolver.types.js";
import { NfeValidationBackfillUseCase } from "../use-cases/nfe-validation-backfill.usecase.js";
import { buildFakeMcpAudit } from "./fake-fiscal-validator.js";

const TENANT_ID = "tenant-01";
const HEALTH = { enabled: true, apiUrl: "http://validator.test", reachable: true, message: "ok" };

function pendingRows(...ids: string[]) {
  return ids.map((id) => ({ id, tipo: "VENDA", xmlAutorizado: null, nfeReferencia: null }));
}

describe("NfeValidationBackfillUseCase", () => {
  let db: { nFe: Record<string, ReturnType<typeof vi.fn>> };
  let validateNfe: ReturnType<typeof vi.fn>;
  let useCase: NfeValidationBackfillUseCase;

  beforeEach(() => {
    db = {
      nFe: {
        findMany: vi.fn(async () => pendingRows("approved", "rejected", "no-xml")),
        update: vi.fn(async () => undefined),
        count: vi.fn(async () => 4),
      },
    };
    validateNfe = vi.fn(async (xml: string) =>
      buildFakeMcpAudit({ approved: xml === "<approved/>" }),
    );
    const validator = {
      config: { enabled: true, apiUrl: HEALTH.apiUrl },
      health: async () => HEALTH,
      validateNfe,
    } as unknown as FiscalValidatorProvider;
    const resolver: NfeXmlContentResolver = {
      resolveXml: async (_db, _tenantId, row) => (row.id === "no-xml" ? null : `<${row.id}/>`),
    };

    useCase = new NfeValidationBackfillUseCase(validator, resolver);
  });

  it("should revalidate pending NF-es and count each outcome", async () => {
    const result = await useCase.execute(db as unknown as DbClient, TENANT_ID);

    assert.deepEqual(
      { ...result, validator: undefined },
      {
        processed: 2,
        approved: 1,
        rejected: 1,
        pending: 0,
        skipped: 1,
        remaining: 4,
        validator: undefined,
      },
    );
    assert.equal(db.nFe.update.mock.calls.length, 2);
  });

  it("should clamp the batch limit to the maximum", async () => {
    await useCase.execute(db as unknown as DbClient, TENANT_ID, { limit: 5_000 });

    assert.equal(db.nFe.findMany.mock.calls[0]![0].take, 200);
  });

  it("should keep the NF-e pending with the operational message when the validator fails", async () => {
    validateNfe.mockRejectedValue(new Error("ECONNREFUSED"));
    db.nFe.findMany.mockResolvedValue(pendingRows("approved"));

    const result = await useCase.execute(db as unknown as DbClient, TENANT_ID);

    assert.equal(result.pending, 1);
    assert.match(result.samplePendingMessage ?? "", /ECONNREFUSED/);
  });
});
