import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifySimulationXmlSignature } from "./xml-signature.js";
import { buildCTeXML } from "./cte-xml.js";
import type { CteFiscalPayload } from "./cte-template.js";

const fiscalPayload: CteFiscalPayload = {
  nfeChaveRef: "35260612345678000199550010000000011000000012",
  nfeTipo: "REMESSA",
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
  icms: { cst: "00", vBC: 41.78, pICMS: 12, vICMS: 5.01 },
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
      chave: "33260603007331010295570010000000421000000426",
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

    assert.match(xml, /<CNPJ>03007331010295<\/CNPJ>/);
    assert.match(xml, /<xNome>EBAZARCOMBR LTDA<\/xNome>/);
    assert.match(xml, /<dest>[\s\S]*<CNPJ>03007331012077<\/CNPJ>/);
    assert.match(xml, /<cMunFim>4206009<\/cMunFim>/);
    assert.match(xml, /<UFFim>SC<\/UFFim>/);
    assert.match(xml, /<chave>35260612345678000199550010000000011000000012<\/chave>/);
    assert.match(xml, /<pICMS>12\.00<\/pICMS>/);
    assert.match(xml, /<vICMS>5\.01<\/vICMS>/);
    assert.doesNotMatch(xml, /<CNPJ>03007331012077<\/CNPJ>[\s\S]*<emit>/);
    assert.equal(verifySimulationXmlSignature(xml), true);
  });
});
