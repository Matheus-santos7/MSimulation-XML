import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NfeValidationStatus } from "../../../../generated/prisma/client.js";
import {
  buildFakeMcpAudit,
  FakeFiscalValidatorAdapter,
} from "../external/fake-fiscal-validator.adapter.js";
import { resolveNfeValidationUpdate } from "./nfe-xml-validation.js";

describe("backfill validation flow", () => {
  it("updates PENDING to APPROVED when validator approves", async () => {
    const validator = new FakeFiscalValidatorAdapter({
      isValid: true,
      message: "XML aprovado",
      errors: [],
      audit: buildFakeMcpAudit({ valida: true }),
    });

    const update = await resolveNfeValidationUpdate(validator, "<nfeProc/>", { enabled: true });

    assert.equal(update.statusValidacao, NfeValidationStatus.APPROVED);
  });

  it("keeps PENDING when validator is disabled during backfill", async () => {
    const validator = new FakeFiscalValidatorAdapter({
      isValid: true,
      message: "unused",
      errors: [],
      audit: buildFakeMcpAudit({ valida: true }),
    });

    const update = await resolveNfeValidationUpdate(validator, "<nfeProc/>", { enabled: false });

    assert.equal(update.statusValidacao, NfeValidationStatus.PENDING);
    assert.match(update.mensagemValidacao ?? "", /desabilitada/i);
  });
});
