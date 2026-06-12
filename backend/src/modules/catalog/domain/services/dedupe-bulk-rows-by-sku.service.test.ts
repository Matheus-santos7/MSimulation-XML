import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dedupeBulkRowsBySku } from "./dedupe-bulk-rows-by-sku.service.js";

describe("dedupeBulkRowsBySku", () => {
  it("mantém a última ocorrência do SKU e emite aviso", () => {
    const { rows, warnings } = dedupeBulkRowsBySku([
      { line: 2, row: { sku: "A", nome: "primeiro" } },
      { line: 4, row: { sku: "A", nome: "segundo" } },
    ]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.row.nome, "segundo");
    assert.equal(rows[0]!.line, 4);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!.message, /duplicado/);
    assert.equal(warnings[0]!.line, 2);
  });
});
