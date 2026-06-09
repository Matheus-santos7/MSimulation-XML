import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  enrichFiscalPayloadMlFulfillment,
  verifySimulationXmlSignature,
} from "@msimulation-xml/fiscal-core";
import { buildNFeXML } from "./nfe-xml-generator.js";
import type { EmitenteXml, NFeXmlInput } from "./types.js";

const emit: EmitenteXml = {
  cnpj: "12345678000199",
  xNome: "Emitente Teste LTDA",
  xFant: "Emitente",
  ie: "1234567890",
  crt: 3,
  uf: "SP",
  endereco: {
    xLgr: "Rua A",
    nro: "100",
    xBairro: "Centro",
    cMun: "3550308",
    xMun: "São Paulo",
    uf: "SP",
    cep: "01001000",
    cPais: 1058,
    xPais: "Brasil",
  },
};

const baseNfe = (): NFeXmlInput => ({
  chave: "35260612345678000199550010000000011000000012",
  numero: 1,
  serie: 1,
  natOp: "Remessa para deposito temporario",
  cfop: "5949",
  ncm: "61091000",
  destinatario: {
    nome: "ML Fulfillment",
    doc: "03007331000141",
    uf: "SP",
    indIEDest: 1,
    endereco: {
      logradouro: "Av B",
      numero: "1",
      bairro: "Distrito",
      codigoMunicipio: "3550308",
      municipio: "São Paulo",
      uf: "SP",
      cep: "01001000",
      codigoPais: 1058,
      nomePais: "Brasil",
    },
  },
  valor: 100,
  valorICMS: 18,
  aliqICMS: 18,
  status: "AUTORIZADA",
  emitidaEm: "2026-06-03T12:00:00-03:00",
  pedidoML: "ORDER-1",
  quantidade: 2,
  tipo: "REMESSA",
  fiscalPayload: {
    engine: {
      itens: [
        {
          vProd: 100,
          quantidade: 2,
          valorUnitario: 50,
          icms: { cst: "00", orig: 0, vBC: 100, pICMS: 18, vICMS: 18 },
          pis: { cst: "09", vBC: 0, vPIS: 0 },
          cofins: { cst: "09", vBC: 0, vCOFINS: 0 },
        },
      ],
      totais: {
        vBC: 100,
        vICMS: 18,
        vProd: 100,
        vIPI: 0,
        vPIS: 0,
        vCOFINS: 0,
        vNF: 100,
      },
    },
  },
});

describe("buildNFeXML — REMESSA", () => {
  it("gera nfeProc com ICMS do engine", () => {
    const xml = buildNFeXML(baseNfe(), emit);
    assert.match(xml, /<nfeProc/);
    assert.match(xml, /<vICMS>18\.00<\/vICMS>/);
    assert.match(xml, /<tpNF>1<\/tpNF>/);
  });

  it("inclui assinatura simulada com Transforms e DigestMethod no Reference", () => {
    const xml = buildNFeXML(baseNfe(), emit);
    assert.match(xml, /<Transforms>/);
    assert.match(xml, /<DigestMethod Algorithm="http:\/\/www\.w3\.org\/2000\/09\/xmldsig#sha1"\/>/);
    assert.match(xml, /<X509Data>/);
    assert.match(xml, /<X509Certificate>[^<]+<\/X509Certificate>/);
  });

  it("nProt no protNFe tem exatamente 15 dígitos", () => {
    const xml = buildNFeXML(baseNfe(), emit);
    const nProt = xml.match(/<nProt>(\d+)<\/nProt>/)?.[1];
    assert.ok(nProt);
    assert.equal(nProt.length, 15);
  });

  it("digVal no protNFe é Base64 válido", () => {
    const xml = buildNFeXML(baseNfe(), emit);
    const digVal = xml.match(/<digVal>([^<]+)<\/digVal>/)?.[1];
    assert.ok(digVal);
    assert.equal(digVal.length, 28);
    assert.match(digVal, /^[A-Za-z0-9+/]+={0,2}$/);
    assert.doesNotMatch(digVal, /-/);
  });

  it("assinatura digital XML-DSig é criptograficamente verificável", () => {
    const xml = buildNFeXML(baseNfe(), emit);
    assert.equal(verifySimulationXmlSignature(xml), true);
  });

  it("formata dhEmi/dhSaiEnt com offset -03:00 (sem sufixo Z)", () => {
    const nfe = baseNfe();
    nfe.emitidaEm = "2026-06-09T04:55:14.442Z";
    const xml = buildNFeXML(nfe, emit);
    assert.match(xml, /<dhEmi>2026-06-09T01:55:14-03:00<\/dhEmi>/);
    assert.match(xml, /<dhSaiEnt>2026-06-09T01:55:14-03:00<\/dhSaiEnt>/);
    assert.doesNotMatch(xml, /T\d{2}:\d{2}:\d{2}(\.\d+)?Z</);
  });

  it("usa PISNT/COFINSNT CST 09 do engine quando a matriz parametriza suspensão", () => {
    const xml = buildNFeXML(baseNfe(), emit);
    assert.match(xml, /<PISNT>\s*<CST>09<\/CST>\s*<\/PISNT>/);
    assert.match(xml, /<COFINSNT>\s*<CST>09<\/CST>\s*<\/COFINSNT>/);
  });

  it("usa PISOutr/COFINSOutr CST 49 do engine (matriz tributária)", () => {
    const nfe = baseNfe();
    nfe.fiscalPayload = {
      engine: {
        itens: [
          {
            vProd: 100,
            quantidade: 2,
            valorUnitario: 50,
            icms: { cst: "00", orig: 0, vBC: 100, pICMS: 18, vICMS: 18 },
            pis: { cst: "49", vBC: 100, vPIS: 0, aliquota: 0 },
            cofins: { cst: "49", vBC: 100, vCOFINS: 0, aliquota: 0 },
          },
        ],
        totais: {
          vBC: 100,
          vICMS: 18,
          vProd: 100,
          vIPI: 0,
          vPIS: 0,
          vCOFINS: 0,
          vNF: 100,
        },
      },
    };
    const xml = buildNFeXML(nfe, emit);
    assert.match(xml, /<PISOutr>\s*<CST>49<\/CST>/);
    assert.match(xml, /<COFINSOutr>\s*<CST>49<\/CST>/);
    assert.doesNotMatch(xml, /<PISNT>/);
  });

  it("fallback do snapshot fiscal usa CST da matriz quando não há engine", () => {
    const nfe = baseNfe();
    nfe.fiscalPayload = {
      pis: { st: "49 - Outras Operações de Saída", aliquota: 0 },
      cofins: { st: "49 - Outras Operações de Saída", aliquota: 0 },
    };
    const xml = buildNFeXML(nfe, emit);
    assert.match(xml, /<PISOutr>\s*<CST>49<\/CST>/);
    assert.match(xml, /<COFINSOutr>\s*<CST>49<\/CST>/);
  });

  it("alinha estrutura ML: IBSCBS, vItem, transporta, autXML e reforma nos totais", () => {
    const xml = buildNFeXML(baseNfe(), emit);
    assert.match(xml, /<IBSCBS>\s*<CST>410<\/CST>\s*<cClassTrib>410999<\/cClassTrib>\s*<\/IBSCBS>/);
    assert.match(xml, /<vItem>100\.00<\/vItem>/);
    assert.match(xml, /<IBSCBSTot>\s*<vBCIBSCBS>0\.00<\/vBCIBSCBS>\s*<\/IBSCBSTot>/);
    assert.match(xml, /<vNFTot>100\.00<\/vNFTot>/);
    assert.match(xml, /<modFrete>2<\/modFrete>/);
    assert.match(xml, /<transporta>/);
    assert.match(xml, /<autXML>\s*<CPF>87659808915<\/CPF>\s*<\/autXML>/);
    assert.match(xml, /<cEnq>999<\/cEnq>/);
    assert.match(xml, /<IPINT>\s*<CST>53<\/CST>\s*<\/IPINT>/);
    assert.match(xml, /Portaria CAT 31\/2019/);
    assert.match(xml, /<xCpl>Nao consta<\/xCpl>/);
    assert.doesNotMatch(xml, /<vFCPUFDest>/);
    assert.doesNotMatch(xml, /<CEST>/);
  });

  it("obsCont external_id segue padrão WAREHOUSE_TRANSFER ML", () => {
    const xml = buildNFeXML(baseNfe(), emit);
    assert.match(
      xml,
      /<xTexto>WAREHOUSE_TRANSFER_MFL_TO_OLSS-inbound-ORDER-1-21-OLS<\/xTexto>/,
    );
  });

  it("usa idCadIntTran e pesos do fiscalPayload enriquecido (emissão real)", () => {
    const nfe = baseNfe();
    nfe.fiscalPayload = enrichFiscalPayloadMlFulfillment(nfe.fiscalPayload ?? {}, {
      quantidadeTotal: 2,
      idCadIntTran: "3272442934",
      destIe: "241174886113",
    });
    const xml = buildNFeXML(nfe, emit);
    assert.match(xml, /<idCadIntTran>3272442934<\/idCadIntTran>/);
    assert.match(xml, /<pesoL>1\.400<\/pesoL>/);
    assert.match(xml, /<pesoB>1\.420<\/pesoB>/);
  });
});
