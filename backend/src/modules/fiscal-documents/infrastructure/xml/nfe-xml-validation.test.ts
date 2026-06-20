import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NfeValidationStatus, Prisma } from "../../../../generated/prisma/client.js";
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
    assert.equal(update.errosValidacao, Prisma.DbNull);
  });

  it("returns REJECTED when validator rejects", async () => {
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
    const validator = {
      async validateNfe() {
        throw new Error("connection refused");
      },
    };

    const update = await resolveNfeValidationUpdate(validator, "<xml/>", { enabled: true });

    assert.equal(update.statusValidacao, NfeValidationStatus.PENDING);
    assert.match(update.mensagemValidacao ?? "", /indisponível/i);
  });
});
