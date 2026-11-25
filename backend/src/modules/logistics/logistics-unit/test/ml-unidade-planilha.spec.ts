import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { buildXlsx } from "../../../../test/xlsx-fixture.js";
import { parseMeliUnidadesXlsx } from "../adapters/mercado-livre/ml-unidade-planilha.js";
import { normalizeIdCadIntTran } from "../adapters/mercado-livre/ml-unidade.normalize.js";

function sheetBuffer(headers: string[], dataRow: (string | number)[]): Promise<Buffer> {
  return buildXlsx({ Unidades: [headers, dataRow] });
}

describe("meli-unidade-planilha", () => {
  it("parseia coluna ID Cad Int Tran", async () => {
    const buf = await sheetBuffer(
      ["Unidade", "CNPJ", "ID Cad Int Tran", "Logradouro", "Número", "Cidade", "UF", "CEP"],
      [
        "SP02 Cajamar",
        "03007331007405",
        "3272442934",
        "Av. Teste",
        "100",
        "Cajamar",
        "SP",
        "07776037",
      ],
    );
    const { rows, errors } = await parseMeliUnidadesXlsx(buf);
    assert.equal(errors.length, 0);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.idCadIntTran, "3272442934");
  });

  it("ignora idCadIntTran quando coluna ausente", async () => {
    const buf = await sheetBuffer(
      ["Unidade", "CNPJ", "Logradouro", "Número", "Cidade", "UF", "CEP"],
      ["SP02", "03007331007405", "Rua A", "1", "Cajamar", "SP", "07776037"],
    );
    const { rows } = await parseMeliUnidadesXlsx(buf);
    assert.equal("idCadIntTran" in (rows[0] ?? {}), false);
  });
});

describe("normalizeIdCadIntTran", () => {
  it("extrai somente dígitos", async () => {
    assert.equal(normalizeIdCadIntTran("ID: 3272442934"), "3272442934");
    assert.equal(normalizeIdCadIntTran(""), null);
  });
});
