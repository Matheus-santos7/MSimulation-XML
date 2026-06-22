import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { HttpMcpFiscalValidatorAdapter } from "./http-mcp-fiscal-validator.adapter.js";

describe("HttpMcpFiscalValidatorAdapter", () => {
  it("passes raw MCP resumo without fallback when approved", async () => {
    const fetchMock = mock.fn(async () =>
      new Response(
        JSON.stringify({
          chave_acesso: "35260601490698006689550580000000311306171272",
          valida_estruturalmente: true,
          chave_consistente: true,
          emissor_ativo: true,
          issues: [],
          resumo: "",
        }),
        { status: 200 },
      ),
    );
    const adapter = new HttpMcpFiscalValidatorAdapter("http://validator.test", fetchMock as typeof fetch);

    const audit = await adapter.validateNfe("<nfeProc/>");

    assert.equal(audit.valida_estruturalmente, true);
    assert.equal(audit.resumo, "");
    assert.deepEqual(audit.issues, []);
  });

  it("passes raw MCP resumo 1:1 when rejected", async () => {
    const fetchMock = mock.fn(async () =>
      new Response(
        JSON.stringify({
          chave_acesso: "35260601490698006689550580000000311306171272",
          valida_estruturalmente: false,
          chave_consistente: true,
          emissor_ativo: true,
          issues: [
            {
              severidade: "critico",
              código: "XML_PARSE_ERROR",
              descrição: "Falha ao parsear XML",
            },
          ],
          resumo: "NFe falhou no parse XML. Verifique arquivo e schema.",
        }),
        { status: 200 },
      ),
    );
    const adapter = new HttpMcpFiscalValidatorAdapter("http://validator.test", fetchMock as typeof fetch);

    const audit = await adapter.validateNfe("<nfeProc/>");

    assert.equal(audit.valida_estruturalmente, false);
    assert.equal(audit.resumo, "NFe falhou no parse XML. Verifique arquivo e schema.");
    assert.match(audit.issues[0]?.descrição ?? "", /parsear XML/i);
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
