import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildIcmsXmlFromEngineItem } from "./fiscal-engine-xml.js";

describe("buildIcmsXmlFromEngineItem", () => {
  it("CST 40 gera ICMS40 sem vBC/pICMS/vICMS", () => {
    const xml = buildIcmsXmlFromEngineItem({
      cst: "40",
      orig: 0,
      vBC: 0,
      pICMS: 0,
      vICMS: 0,
    });
    assert.match(xml, /<ICMS40>/);
    assert.match(xml, /<CST>40<\/CST>/);
    assert.doesNotMatch(xml, /<vBC>/);
    assert.doesNotMatch(xml, /<pICMS>/);
  });

  it("CST 90 zerado gera ICMS90 sem tributação efetiva", () => {
    const xml = buildIcmsXmlFromEngineItem({
      cst: "90",
      orig: 2,
      vBC: 0,
      pICMS: 0,
      vICMS: 0,
    });
    assert.match(xml, /<ICMS90>/);
    assert.doesNotMatch(xml, /<vBC>/);
  });

  it("CST 00 mantém grupo tributado completo", () => {
    const xml = buildIcmsXmlFromEngineItem({
      cst: "00",
      orig: 0,
      modBC: 3,
      vBC: 100,
      pICMS: 18,
      vICMS: 18,
    });
    assert.match(xml, /<ICMS00>/);
    assert.match(xml, /<vBC>100\.00<\/vBC>/);
    assert.match(xml, /<vICMS>18\.00<\/vICMS>/);
  });
});
