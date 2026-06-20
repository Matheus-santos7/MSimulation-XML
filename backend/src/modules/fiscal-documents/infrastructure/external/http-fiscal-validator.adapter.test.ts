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
    assert.match(result.message, /aprovada/i);
    assert.deepEqual(result.errors, []);
    assert.equal(result.audit.valida, true);
    assert.equal(fetchMock.mock.calls.length, 1);
  });

  it("maps valida=false to rejected result with errors and resumo", async () => {
    const fetchMock = mock.fn(async () =>
      new Response(
        JSON.stringify({
          valida: false,
          erros: ["[CRITICO] CFOP 6949 incompatível com CST ICMS 00"],
          resumo: "NF-e rejeitada: 1 achado(s) crítico(s), 0 alto(s), 1 no total.",
        }),
        { status: 200 },
      ),
    );
    const adapter = new HttpFiscalValidatorAdapter("http://validator.test", fetchMock as typeof fetch);

    const result = await adapter.validateNfe("<nfeProc/>");

    assert.equal(result.isValid, false);
    assert.match(result.message, /rejeitada/i);
    assert.match(result.errors[0] ?? "", /CFOP 6949/i);
    assert.equal(result.audit.achados.length, 0);
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
