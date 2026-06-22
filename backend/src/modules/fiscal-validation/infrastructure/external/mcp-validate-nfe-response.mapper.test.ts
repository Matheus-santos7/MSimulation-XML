import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapMcpValidateNfeResponse } from "./mcp-validate-nfe-response.mapper.js";

describe("mapMcpValidateNfeResponse", () => {
  it("passes raw validate_nfe_full fields through unchanged", () => {
    const audit = mapMcpValidateNfeResponse({
      chave_acesso: "35260601490698006689550580000000311306171272",
      valida_estruturalmente: true,
      chave_consistente: true,
      emissor_ativo: true,
      cnpj_emissor: "01490698006689",
      valor_total: 809,
      data_emissao: "2026-06-19",
      issues: [],
      resumo: "NFe válida estruturalmente, chave consistente, emissor ativo.",
    });

    assert.equal(audit.chave_acesso, "35260601490698006689550580000000311306171272");
    assert.equal(audit.valida_estruturalmente, true);
    assert.equal(audit.chave_consistente, true);
    assert.equal(audit.emissor_ativo, true);
    assert.equal(audit.cnpj_emissor, "01490698006689");
    assert.equal(audit.valor_total, 809);
    assert.equal(audit.data_emissao, "2026-06-19");
    assert.deepEqual(audit.issues, []);
    assert.equal(audit.resumo, "NFe válida estruturalmente, chave consistente, emissor ativo.");
  });

  it("maps MCP issues with accented field names", () => {
    const audit = mapMcpValidateNfeResponse({
      valida_estruturalmente: false,
      issues: [
        {
          severidade: "critico",
          código: "XML_PARSE_ERROR",
          descrição: "Falha ao parsear XML",
        },
      ],
      resumo: "NFe falhou no parse XML.",
    });

    assert.equal(audit.issues[0]?.código, "XML_PARSE_ERROR");
    assert.equal(audit.issues[0]?.descrição, "Falha ao parsear XML");
  });

  it("returns empty resumo when field is absent", () => {
    const audit = mapMcpValidateNfeResponse({ valida_estruturalmente: true });
    assert.equal(audit.resumo, "");
  });
});
