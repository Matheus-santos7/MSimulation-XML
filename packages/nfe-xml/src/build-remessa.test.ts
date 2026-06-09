import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
    assert.match(xml, /<KeyName>FAKE-SIMULATION-ONLY<\/KeyName>/);
  });

  it("formata dhEmi/dhSaiEnt com offset -03:00 (sem sufixo Z)", () => {
    const nfe = baseNfe();
    nfe.emitidaEm = "2026-06-09T04:55:14.442Z";
    const xml = buildNFeXML(nfe, emit);
    assert.match(xml, /<dhEmi>2026-06-09T01:55:14-03:00<\/dhEmi>/);
    assert.match(xml, /<dhSaiEnt>2026-06-09T01:55:14-03:00<\/dhSaiEnt>/);
    assert.doesNotMatch(xml, /T\d{2}:\d{2}:\d{2}(\.\d+)?Z</);
  });
});
