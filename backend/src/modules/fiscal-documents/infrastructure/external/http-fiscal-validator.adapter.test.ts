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
