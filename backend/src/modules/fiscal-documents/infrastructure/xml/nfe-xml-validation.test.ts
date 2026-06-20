import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NfeValidationStatus, Prisma } from "../../../../generated/prisma/client.js";
import {
  buildFakeMcpAudit,
  FakeFiscalValidatorAdapter,
} from "../external/fake-fiscal-validator.adapter.js";
import { resolveNfeValidationUpdate } from "./nfe-xml-validation.js";

describe("resolveNfeValidationUpdate", () => {
  it("returns APPROVED when validator approves", async () => {
    const audit = buildFakeMcpAudit({ valida: true, resumo: "XML aprovado" });
    const validator = new FakeFiscalValidatorAdapter({
      isValid: true,
      message: "XML aprovado",
      errors: [],
      audit,
    });

    const update = await resolveNfeValidationUpdate(validator, "<xml/>", { enabled: true });

    assert.equal(update.statusValidacao, NfeValidationStatus.APPROVED);
    assert.equal(update.mensagemValidacao, "XML aprovado");
    assert.equal(update.errosValidacao, Prisma.DbNull);
    assert.deepEqual(update.auditoriaMcp, audit);
  });

  it("returns REJECTED when validator rejects", async () => {
    const audit = buildFakeMcpAudit({
      valida: false,
      resumo: "NF-e rejeitada",
      erros: ["CST 00 exige vBC"],
      achados: [{ severidade: "critico", codigo: "CFOP_CST", mensagem: "CST 00 exige vBC" }],
    });
    const validator = new FakeFiscalValidatorAdapter({
      isValid: false,
      message: "Foram encontrados erros estruturais/fiscais no XML.",
      errors: ["CST 00 exige vBC"],
      audit,
    });

    const update = await resolveNfeValidationUpdate(validator, "<xml/>", { enabled: true });

    assert.equal(update.statusValidacao, NfeValidationStatus.REJECTED);
    assert.deepEqual(update.errosValidacao, ["CST 00 exige vBC"]);
    assert.deepEqual(update.auditoriaMcp, audit);
  });

  it("returns PENDING when validator is disabled", async () => {
    const validator = new FakeFiscalValidatorAdapter({
      isValid: true,
      message: "unused",
      errors: [],
      audit: buildFakeMcpAudit({ valida: true }),
    });

    const update = await resolveNfeValidationUpdate(validator, "<xml/>", { enabled: false });

    assert.equal(update.statusValidacao, NfeValidationStatus.PENDING);
    assert.match(update.mensagemValidacao ?? "", /desabilitada/i);
    assert.equal(update.auditoriaMcp, Prisma.DbNull);
  });

  it("returns PENDING when validator HTTP throws", async () => {
    const validator = {
      async validateNfe() {
        throw new Error("connection refused");
      },
    };

    const update = await resolveNfeValidationUpdate(validator, "<xml/>", { enabled: true });

    assert.equal(update.statusValidacao, NfeValidationStatus.PENDING);
    assert.match(update.mensagemValidacao ?? "", /indisponível/i);
    assert.equal(update.auditoriaMcp, Prisma.DbNull);
  });
});
