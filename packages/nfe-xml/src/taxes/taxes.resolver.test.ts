import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { serializeXmlObject } from "../core/xml-serializer.js";
import { buildIcmsXmlFromEngineItem, buildPisCofinsXmlFromEngine } from "../fiscal-engine-xml.js";
import { impostoIpiIntXml, VENDA_IBS_CBS_DEFAULTS } from "../fiscal/fiscal-xml.util.js";
import { resolveIcmsFromEngine, resolveIcmsFromSnapshot } from "./icms.resolver.js";
import { resolveIbsCbsImposto, resolveIbsCbsImpostoVenda } from "./ibscbs.resolver.js";
import { resolveIpiInt, resolveIpiFromEngine } from "./ipi.resolver.js";
import { resolvePisCofinsFromEngine } from "./pis-cofins.resolver.js";

/** Normaliza XML para comparação (remove whitespace entre tags). */
function compactXml(xml: string): string {
  return xml.replace(/>\s+</g, "><").trim();
}

describe("resolveIcmsFromSnapshot", () => {
  it("CST 00 usa valor e valorIcms do contexto", () => {
    const node = resolveIcmsFromSnapshot({ cst: "00", aliquota: 18 }, {
      orig: 0,
      valor: 100,
      valorIcms: 18,
    });
    const icms00 = node.ICMS.ICMS00 as Record<string, string>;
    assert.equal(icms00.CST, "00");
    assert.equal(icms00.vBC, "100.00");
    assert.equal(icms00.vICMS, "18.00");
  });

  it("CST 40 gera ICMS40 sem bases", () => {
    const node = resolveIcmsFromSnapshot({ cst: "40" }, { orig: 0, valor: 50, valorIcms: 0 });
    const icms40 = node.ICMS.ICMS40 as Record<string, unknown>;
    assert.equal(icms40.CST, "40");
    assert.equal("vBC" in icms40, false);
  });
});

describe("resolveIcmsFromEngine", () => {
  it("espelha buildIcmsXmlFromEngineItem para CST 00", () => {
    const icms = { cst: "00", orig: 0, modBC: 3, vBC: 100, pICMS: 18, vICMS: 18 };
    const expected = compactXml(buildIcmsXmlFromEngineItem(icms));
    const actual = compactXml(serializeXmlObject(resolveIcmsFromEngine(icms)));
    assert.equal(actual, expected);
  });

  it("CST 10 emite grupo ICMS10 com vBCST/vICMSST", () => {
    const node = resolveIcmsFromEngine({
      cst: "10",
      orig: 0,
      modBC: 3,
      vBC: 100,
      pICMS: 12,
      vICMS: 12,
      modBCST: 4,
      pMVAST: 40,
      pRedBCST: 0,
      vBCST: 140,
      pICMSST: 18,
      vICMSST: 13.2,
      stCobraNaOperacao: true,
    });
    const icms10 = node.ICMS.ICMS10 as Record<string, string>;
    assert.equal(icms10.CST, "10");
    assert.equal(icms10.vBCST, "140.00");
    assert.equal(icms10.vICMSST, "13.20");
    assert.equal(icms10.pMVAST, "40.0000");
  });

  it("CST 10 com FCP-ST emite vBCFCPST/pFCPST/vFCPST", () => {
    const node = resolveIcmsFromEngine({
      cst: "10",
      orig: 0,
      modBC: 3,
      vBC: 100,
      pICMS: 12,
      vICMS: 12,
      pFCP: 0,
      vFCP: 0,
      modBCST: 4,
      pMVAST: 40,
      pRedBCST: 0,
      vBCST: 140,
      pICMSST: 18,
      vICMSST: 13.2,
      pFCPST: 2,
      vFCPST: 2.8,
      stCobraNaOperacao: true,
    });
    const icms10 = node.ICMS.ICMS10 as Record<string, string>;
    assert.equal(icms10.pFCPST, "2.0000");
    assert.equal(icms10.vFCPST, "2.80");
    assert.equal(icms10.vBCFCPST, "140.00");
    assert.equal(icms10.pFCP, undefined);
  });

  it("CST 00 DIFAL: sem pFCP no ICMS quando pFCP=0", () => {
    const node = resolveIcmsFromEngine({
      cst: "00",
      orig: 0,
      modBC: 3,
      vBC: 1000,
      pICMS: 12,
      vICMS: 120,
      pFCP: 0,
      vFCP: 0,
    });
    const icms00 = node.ICMS.ICMS00 as Record<string, string>;
    assert.equal(icms00.pICMS, "12.0000");
    assert.equal(icms00.pFCP, undefined);
    assert.equal(icms00.vFCP, undefined);
  });

  it("CST 60 emite Ret sem grupo de cobrança própria", () => {
    const node = resolveIcmsFromEngine({
      cst: "60",
      orig: 0,
      vBC: 0,
      pICMS: 0,
      vICMS: 0,
      vBCST: 280,
      pICMSST: 18,
      vICMSST: 50.4,
      stCobraNaOperacao: false,
    });
    const icms60 = node.ICMS.ICMS60 as Record<string, string>;
    assert.equal(icms60.CST, "60");
    assert.equal(icms60.vBCSTRet, "280.00");
    assert.equal(icms60.vICMSSTRet, "50.40");
  });
});

describe("resolveIpiInt", () => {
  it("espelha impostoIpiIntXml com defaults CST 55 e cEnq 103", () => {
    const expected = compactXml(impostoIpiIntXml());
    const actual = compactXml(serializeXmlObject(resolveIpiInt()));
    assert.equal(actual, expected);
  });

  it("resolveIpiFromEngine gera IPINT para CST 55", () => {
    const node = resolveIpiFromEngine({ cst: "55", vBC: 0, pIPI: 0, vIPI: 0 });
    assert.deepEqual(node.IPI.IPINT, { CST: "55" });
    assert.equal("IPITrib" in node.IPI, false);
  });
});

describe("resolvePisCofinsFromEngine", () => {
  it("espelha buildPisCofinsXmlFromEngine para CST alíquota", () => {
    const pis = { cst: "01", vBC: 100, pPIS: 1.65, vPIS: 1.65 };
    const cofins = { cst: "01", vBC: 100, pCOFINS: 7.6, vCOFINS: 7.6 };
    const expected = compactXml(buildPisCofinsXmlFromEngine(pis, cofins));
    const nodes = resolvePisCofinsFromEngine(pis, cofins);
    const actual = compactXml(
      serializeXmlObject({ imposto: { ...nodes.pis, ...nodes.cofins } }).replace(/^<imposto>|<\/imposto>$/g, ""),
    );
    assert.equal(actual, expected);
  });

  it("usa grupo Outr quando apenas PIS é CST 49", () => {
    const nodes = resolvePisCofinsFromEngine(
      { cst: "49", vBC: 10, pPIS: 0, vPIS: 0 },
      { cst: "01", vBC: 10, pCOFINS: 7.6, vCOFINS: 0.76 },
    );
    assert.ok(nodes.pis.PIS.PISOutr);
    assert.ok(nodes.cofins.COFINS.COFINSOutr);
  });

  it("PISAliq/COFINSAliq propagam <vBC> reduzido (Tese do Século) do engine", () => {
    // Caso paridade ML Full: engine entrega vBC = 646.72 já com ICMS/DIFAL excluídos.
    const pis = { cst: "01", vBC: 646.72, pPIS: 1.65, vPIS: 10.67 };
    const cofins = { cst: "01", vBC: 646.72, pCOFINS: 7.6, vCOFINS: 49.15 };
    const nodes = resolvePisCofinsFromEngine(pis, cofins);
    const pisAliq = nodes.pis.PIS.PISAliq as Record<string, string>;
    const cofinsAliq = nodes.cofins.COFINS.COFINSAliq as Record<string, string>;
    assert.equal(pisAliq.vBC, "646.72");
    assert.equal(pisAliq.vPIS, "10.67");
    assert.equal(cofinsAliq.vBC, "646.72");
    assert.equal(cofinsAliq.vCOFINS, "49.15");
  });
});

describe("resolveIbsCbsImposto", () => {
  it("retorna null quando venda sem payload explícito", () => {
    assert.equal(
      resolveIbsCbsImposto({
        ibsCbs: null,
        defaults: VENDA_IBS_CBS_DEFAULTS,
        alwaysEmit: false,
      }),
      null,
    );
  });

  it("emite CST e cClassTrib com gIBSCBS quando vBC informado", () => {
    const node = resolveIbsCbsImposto({
      ibsCbs: { st: "000", cClassTrib: "000001" },
      defaults: VENDA_IBS_CBS_DEFAULTS,
      alwaysEmit: false,
      vBC: 150.5,
    });
    assert.ok(node);
    assert.equal(node!.IBSCBS.CST, "000");
    const gIbscbs = node!.IBSCBS.gIBSCBS as { vBC: string };
    assert.equal(gIbscbs.vBC, "150.50");
  });

  it("resolveIbsCbsImpostoVenda inclui grupos de alíquota", () => {
    const node = resolveIbsCbsImpostoVenda({ st: "000", cClassTrib: "000001" }, 1000);
    assert.ok(node);
    const gIbscbs = node!.IBSCBS.gIBSCBS as Record<string, unknown>;
    assert.ok(gIbscbs.gIBSUF);
    assert.ok(gIbscbs.gCBS);
  });
});
