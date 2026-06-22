import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { HttpMcpFiscalValidatorAdapter } from "./http-mcp-fiscal-validator.adapter.js";

describe("HttpMcpFiscalValidatorAdapter", () => {
  it("passes MCP resumo without fallback when approved", async () => {
    const fetchMock = mock.fn(async () =>
      new Response(JSON.stringify({ valida: true, erros: [], resumo: "" }), { status: 200 }),
    );
    const adapter = new HttpMcpFiscalValidatorAdapter("http://validator.test", fetchMock as typeof fetch);

    const audit = await adapter.validateNfe("<nfeProc/>");

    assert.equal(audit.valida, true);
    assert.equal(audit.resumo, "");
    assert.deepEqual(audit.erros, []);
  });

  it("passes MCP resumo 1:1 when rejected", async () => {
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
    const adapter = new HttpMcpFiscalValidatorAdapter("http://validator.test", fetchMock as typeof fetch);

    const audit = await adapter.validateNfe("<nfeProc/>");

    assert.equal(audit.valida, false);
    assert.equal(audit.resumo, "NF-e rejeitada: 1 achado(s) crítico(s), 0 alto(s), 1 no total.");
    assert.match(audit.erros[0] ?? "", /CFOP 6949/i);
  });

  it("throws when HTTP status is not ok", async () => {
    const fetchMock = mock.fn(async () => new Response("down", { status: 503 }));
    const adapter = new HttpMcpFiscalValidatorAdapter("http://validator.test", fetchMock as typeof fetch);

    await assert.rejects(
      () => adapter.validateNfe("<nfeProc/>"),
      /microsserviço de validação/i,
    );
  });
});
