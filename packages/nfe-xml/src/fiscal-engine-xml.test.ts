import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildIcmsUfDestXmlFromEngine, buildIcmsXmlFromEngineItem } from "./fiscal-engine-xml.js";

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

  it("gera ICMSUFDest com partilha total para destino", () => {
    const xml = buildIcmsUfDestXmlFromEngine({
      vBCUFDest: 1060.29,
      pICMSUFDest: 18,
      pICMSInter: 12,
      pICMSInterPart: 100,
      vICMSUFDest: 63.62,
      vICMSUFRemet: 0,
    });
    assert.match(xml, /<ICMSUFDest>/);
    assert.match(xml, /<vBCUFDest>1060\.29<\/vBCUFDest>/);
    assert.match(xml, /<pICMSInter>12\.00<\/pICMSInter>/);
    assert.match(xml, /<pICMSInterPart>100\.00<\/pICMSInterPart>/);
    assert.match(xml, /<vICMSUFDest>63\.62<\/vICMSUFDest>/);
    assert.match(xml, /<vICMSUFRemet>0\.00<\/vICMSUFRemet>/);
  });

  it("não emite ICMSUFDest sem base ou valores válidos", () => {
    assert.equal(buildIcmsUfDestXmlFromEngine({
      vBCUFDest: 0,
      pICMSUFDest: 18,
      pICMSInter: 4,
      vICMSUFDest: 0,
    }), "");
  });
});
