import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { describe, it } from "node:test";
import { parseMeliUnidadesXlsx } from "./meli-unidade-planilha.js";
import { normalizeIdCadIntTran } from "./meli-unidade.js";

function sheetBuffer(headers: string[], dataRow: (string | number)[]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([headers, dataRow]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Unidades");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

describe("meli-unidade-planilha", () => {
  it("parseia coluna ID Cad Int Tran", () => {
    const buf = sheetBuffer(
      ["Unidade", "CNPJ", "ID Cad Int Tran", "Logradouro", "Número", "Cidade", "UF", "CEP"],
      ["SP02 Cajamar", "03007331007405", "3272442934", "Av. Teste", "100", "Cajamar", "SP", "07776037"],
    );
    const { rows, errors } = parseMeliUnidadesXlsx(buf);
    assert.equal(errors.length, 0);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.idCadIntTran, "3272442934");
  });

  it("ignora idCadIntTran quando coluna ausente", () => {
    const buf = sheetBuffer(
      ["Unidade", "CNPJ", "Logradouro", "Número", "Cidade", "UF", "CEP"],
      ["SP02", "03007331007405", "Rua A", "1", "Cajamar", "SP", "07776037"],
    );
    const { rows } = parseMeliUnidadesXlsx(buf);
    assert.equal("idCadIntTran" in (rows[0] ?? {}), false);
  });
});

describe("normalizeIdCadIntTran", () => {
  it("extrai somente dígitos", () => {
    assert.equal(normalizeIdCadIntTran("ID: 3272442934"), "3272442934");
    assert.equal(normalizeIdCadIntTran(""), null);
  });
});
