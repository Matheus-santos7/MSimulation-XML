import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { taxSnapshotFromRule } from "./tax-snapshot.js";

describe("taxSnapshotFromRule", () => {
  it("preserva codEnq numérico da planilha (ex.: 103)", () => {
    const snapshot = taxSnapshotFromRule(
      {
        ruleId: "4133250058-SP-taxpayer-inbound",
        aliquotaIcmsInterna: 0,
        payload: {
          taxes: {
            ipi: {
              st: "55 - Saída com Suspensão",
              aliquota: 0,
              codEnq: 103,
            },
          },
        },
      },
      18,
    );

    assert.equal(snapshot.ipi.codEnq, "103");
    assert.equal(snapshot.ipi.st, "55 - Saída com Suspensão");
  });
});
