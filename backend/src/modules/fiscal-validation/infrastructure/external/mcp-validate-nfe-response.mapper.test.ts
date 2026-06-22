import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapMcpValidateNfeResponse } from "./mcp-validate-nfe-response.mapper.js";

describe("mapMcpValidateNfeResponse", () => {
  it("passes resumo through unchanged", () => {
    const audit = mapMcpValidateNfeResponse({
      valida: true,
      resumo: "NF-e aprovada na auditoria fiscal (estrutura, chave e regras de fulfillment).",
      erros: [],
    });
    assert.equal(
      audit.resumo,
      "NF-e aprovada na auditoria fiscal (estrutura, chave e regras de fulfillment).",
    );
  });

  it("returns empty resumo when field is absent", () => {
    const audit = mapMcpValidateNfeResponse({ valida: true });
    assert.equal(audit.resumo, "");
  });
});
