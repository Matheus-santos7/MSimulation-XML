import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveTaxRuleRefFromCatalog } from "./resolve-tax-rule-ref-from-catalog.js";
import type { TaxRuleCatalogEntry } from "../entities/tax-rule-catalog-entry.entity.js";

function entry(baseId: string, nome: string): TaxRuleCatalogEntry {
  return { baseId, nome, origin: "SP", label: `${nome} · origem SP` };
}

/** Catálogo no formato de `listCatalogEntries` (nome já sem sufixo de operação). */
const catalog: TaxRuleCatalogEntry[] = [
  entry("355076", "Chuveiro"),
  entry("press-84137080", "Pressurizador 84137080 – Importado"),
  entry("lamp-85395200", "Lâmpadas 85395200 – Importada"),
  entry("aq-8419110001", "Aquecedor 8419110001 – Importado"),
  entry("aq-85161000", "Aquecedor 85161000 – Nacional"),
  entry("pur-84212100", "Purificador 84212100 – Nacional"),
  entry("tor-84818019-nac", "Torneira 84818019 – Nacional"),
  entry("tor-85167990-nac", "Torneira 85167990 – Nacional"),
  entry("tor-84818019-imp", "Torneira 84818019 – Importada"),
  entry("texteis-a", "Produtos Têxteis"),
  entry("texteis-b", "Produtos Têxteis"),
  entry("4133250001", "4133250001"),
];

describe("resolveTaxRuleRefFromCatalog", () => {
  it("resolve família pelo nome Chuveiro", () => {
    const result = resolveTaxRuleRefFromCatalog("Chuveiro", catalog);
    assert.deepEqual(result, { ok: true, baseId: "355076" });
  });

  it("ignora sufixo de operação no valor da célula", () => {
    const result = resolveTaxRuleRefFromCatalog("Chuveiro (Não contribuinte)", catalog);
    assert.deepEqual(result, { ok: true, baseId: "355076" });
  });

  it("resolve pelo baseId quando a célula é o código da família", () => {
    const result = resolveTaxRuleRefFromCatalog("4133250001", catalog);
    assert.deepEqual(result, { ok: true, baseId: "4133250001" });
  });

  it("não associa Torneira sozinho (três famílias distintas)", () => {
    const result = resolveTaxRuleRefFromCatalog("Torneira", catalog);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /não encontrada/i);
  });

  it("não associa Aquecedor sozinho (duas famílias distintas)", () => {
    const result = resolveTaxRuleRefFromCatalog("Aquecedor", catalog);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /não encontrada/i);
  });

  it("resolve nome completo de uma família de torneira", () => {
    const result = resolveTaxRuleRefFromCatalog("Torneira 84818019 – Nacional", catalog);
    assert.deepEqual(result, { ok: true, baseId: "tor-84818019-nac" });
  });

  it("trata hífen ASCII como o travessão do cadastro", () => {
    const result = resolveTaxRuleRefFromCatalog("Torneira 84818019 - Nacional", catalog);
    assert.deepEqual(result, { ok: true, baseId: "tor-84818019-nac" });
  });

  it("rejeita nome de família ambíguo (dois baseId)", () => {
    const result = resolveTaxRuleRefFromCatalog("Produtos Têxteis", catalog);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /ambígu/i);
      assert.match(result.message, /código/i);
    }
  });

  it("rejeita nome inexistente", () => {
    const result = resolveTaxRuleRefFromCatalog("Regra Inexistente", catalog);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /não encontrada/i);
  });
});
