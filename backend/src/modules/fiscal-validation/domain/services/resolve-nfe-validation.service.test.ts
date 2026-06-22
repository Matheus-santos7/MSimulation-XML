import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "../../../../generated/prisma/client.js";
import {
  VALIDATION_DISABLED_MESSAGE,
  validatorUnavailableMessage,
} from "../constants/operational-validation-messages.js";
import {
  buildFakeMcpAudit,
  FakeMcpFiscalValidatorAdapter,
} from "../../infrastructure/external/fake-mcp-fiscal-validator.adapter.js";
import { resolveNfeValidation } from "./resolve-nfe-validation.service.js";

describe("resolveNfeValidation", () => {
  it("returns APPROVED with MCP resumo as message", async () => {
    const audit = buildFakeMcpAudit({ valida: true, resumo: "XML aprovado pelo proxy" });
    const validator = new FakeMcpFiscalValidatorAdapter(audit);

    const outcome = await resolveNfeValidation(validator, "<xml/>", { enabled: true });

    assert.equal(outcome.status, "APPROVED");
    assert.equal(outcome.message, "XML aprovado pelo proxy");
    assert.deepEqual(outcome.audit, audit);
  });

  it("returns null message when MCP resumo is empty", async () => {
    const audit = buildFakeMcpAudit({ valida: true, resumo: "" });
    const validator = new FakeMcpFiscalValidatorAdapter(audit);

    const outcome = await resolveNfeValidation(validator, "<xml/>", { enabled: true });

    assert.equal(outcome.message, null);
  });

  it("returns REJECTED with MCP errors", async () => {
    const audit = buildFakeMcpAudit({
      valida: false,
      resumo: "NF-e rejeitada",
      erros: ["CST 00 exige vBC"],
    });
    const validator = new FakeMcpFiscalValidatorAdapter(audit);

    const outcome = await resolveNfeValidation(validator, "<xml/>", { enabled: true });

    assert.equal(outcome.status, "REJECTED");
    assert.deepEqual(outcome.errors, ["CST 00 exige vBC"]);
  });

  it("returns PENDING when validator is disabled", async () => {
    const validator = new FakeMcpFiscalValidatorAdapter(buildFakeMcpAudit({ valida: true }));

    const outcome = await resolveNfeValidation(validator, "<xml/>", { enabled: false });

    assert.equal(outcome.status, "PENDING");
    assert.equal(outcome.message, VALIDATION_DISABLED_MESSAGE);
    assert.equal(outcome.audit, null);
  });

  it("returns PENDING when validator HTTP throws", async () => {
    const validator = {
      async validateNfe() {
        throw new Error("connection refused");
      },
    };

    const outcome = await resolveNfeValidation(validator, "<xml/>", { enabled: true });

    assert.equal(outcome.status, "PENDING");
    assert.equal(outcome.message, validatorUnavailableMessage("connection refused"));
    assert.equal(outcome.audit, null);
  });
});

describe("toPrismaNfeValidationUpdate", () => {
  it("maps APPROVED outcome to Prisma fields", async () => {
    const { toPrismaNfeValidationUpdate } = await import("../../infrastructure/prisma/nfe-validation-persistence.mapper.js");
    const audit = buildFakeMcpAudit({ valida: true, resumo: "ok" });
    const update = toPrismaNfeValidationUpdate({
      status: "APPROVED",
      message: "ok",
      errors: null,
      audit,
    });

    assert.equal(update.statusValidacao, "APPROVED");
    assert.equal(update.mensagemValidacao, "ok");
    assert.equal(update.errosValidacao, Prisma.DbNull);
    assert.deepEqual(update.auditoriaMcp, audit);
  });
});
