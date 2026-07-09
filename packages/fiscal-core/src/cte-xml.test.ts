import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifySimulationXmlSignature } from "./xml-signature.js";
import { buildCTeXML } from "./cte-xml.js";
import {
  calcularIbsCbsFreteCte,
  calcularIcmsFreteCte,
  type CteFiscalPayload,
} from "./cte-template.js";
import { mapLogisticsUnitToCteEmitente } from "./cte-emitente.js";

const vFrete = 41.78;
const icms = calcularIcmsFreteCte(vFrete, "SP", "SC", 0);
const ibsCbs = calcularIbsCbsFreteCte(vFrete, icms);

const emitenteSp = mapLogisticsUnitToCteEmitente({
  cnpj: "03007331007405",
  ie: "241174886113",
  destNomeFiscal: "EBAZAR.COM.BR LTDA",
  nome: "Cajamar",
  logradouro: "Av Antonio Candido Machado",
  numero: "3100",
  bairro: "Centro",
  codigoMunicipio: "3509205",
  municipio: "Cajamar",
  uf: "SP",
  cep: "07776037",
});

const fiscalPayload: CteFiscalPayload = {
  nfeChaveRef: "35260612345678000199550010000000011000000012",
  nfeTipo: "REMESSA",
  emitente: emitenteSp,
  remetente: {
    doc: "12345678000199",
    nome: "Seller LTDA",
    ie: "1234567890",
    endereco: {
      logradouro: "Rua A",
      numero: "100",
      bairro: "Centro",
      codigoMunicipio: "3550308",
      municipio: "São Paulo",
      uf: "SP",
      cep: "01001000",
    },
  },
  destinatario: {
    doc: "03007331012077",
    nome: "EBAZAR.COM.BR LTDA",
    ie: "261755994",
    endereco: {
      logradouro: "Av. Papenborg",
      numero: "S/N",
      complemento: "Nao consta",
      bairro: "Guaporanga",
      codigoMunicipio: "4206009",
      municipio: "Governador Celso Ramos",
      uf: "SC",
      cep: "88190000",
    },
  },
  icms,
  ibsCbs,
  rota: {
    cMunIni: "3550308",
    xMunIni: "São Paulo",
    ufIni: "SP",
    cMunFim: "4206009",
    xMunFim: "Governador Celso Ramos",
    ufFim: "SC",
    origem: "São Paulo/SP",
    destino: "Governador Celso Ramos/SC",
  },
};

describe("buildCTeXML", () => {
  it("usa emitente Ebazar, destinatário da NF-e e infNFe com chave", () => {
    const xml = buildCTeXML({
      chave: "35260603007331007405570011000000421000000426",
      numero: 42,
      serie: 1,
      cfop: "6353",
      natOp: "PRESTAÇÕES DE SERVIÇOS DE TRANSPORTE",
      valor: 41.78,
      valorCarga: 6090,
      pesoCarga: 9.65,
      status: "AUTORIZADA",
      emitidoEm: "2026-06-10T10:00:00-03:00",
      fiscalPayload,
    });

    assert.match(xml, /<cUF>35<\/cUF>/);
    assert.match(xml, /<cMunEnv>3509205<\/cMunEnv>/);
    assert.match(xml, /<UFEnv>SP<\/UFEnv>/);
    assert.match(xml, /<CNPJ>03007331007405<\/CNPJ>/);
    assert.match(xml, /<xNome>EBAZARCOMBR LTDA<\/xNome>/);
    assert.match(xml, /<dest>[\s\S]*<CNPJ>03007331012077<\/CNPJ>/);
    assert.match(xml, /<cMunFim>4206009<\/cMunFim>/);
    assert.match(xml, /<UFFim>SC<\/UFFim>/);
    assert.match(xml, /<chave>35260612345678000199550010000000011000000012<\/chave>/);
    assert.match(xml, /<pICMS>12\.00<\/pICMS>/);
    assert.match(xml, /<vICMS>5\.01<\/vICMS>/);
    assert.match(xml, /<IBSCBS>[\s\S]*<CST>000<\/CST>/);
    assert.match(xml, new RegExp(`<vBC>${ibsCbs.vBC.toFixed(2).replace(".", "\\.")}<\\/vBC>`));
    assert.match(xml, new RegExp(`<vTotDFe>${ibsCbs.vTotDFe.toFixed(2).replace(".", "\\.")}<\\/vTotDFe>`));
    assert.doesNotMatch(xml, /<CNPJ>03007331012077<\/CNPJ>[\s\S]*<emit>/);
    assert.equal(verifySimulationXmlSignature(xml), true);
  });
});
