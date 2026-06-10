import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCteFiscalPayload,
  calcularIcmsFreteCte,
  calcularValorFreteRemessa,
  CTE_REMESSA_CFOP,
  CTE_VENDA_CFOP,
  resolveAliqIcmsFrete,
  resolveCteDocumento,
} from "./cte-template.js";

const tenant = {
  cnpj: "12345678000199",
  ie: "1234567890",
  razaoSocial: "Seller LTDA",
  logradouro: "Rua A",
  numero: "100",
  bairro: "Centro",
  codigoMunicipio: "3550308",
  municipio: "São Paulo",
  uf: "SP",
  cep: "01001000",
};

const nfeRemessa = {
  destNome: "EBAZAR.COM.BR LTDA",
  destDoc: "03007331012077",
  destUf: "SC",
  destIndIeDest: 1,
  destLogradouro: "Av. Papenborg",
  destNumero: "S/N",
  destComplemento: "Nao consta",
  destBairro: "Guaporanga",
  destCodigoMunicipio: "4206009",
  destMunicipio: "Governador Celso Ramos",
  destCep: "88190000",
  valor: 6090,
  quantidade: 10,
  aliqIcms: 0,
  chave: "35260612345678000199550010000000011000000012",
  tipo: "REMESSA",
  fiscalPayload: { destIe: "261755994" },
};

describe("cte-template", () => {
  it("calcula frete mínimo ML", () => {
    assert.equal(calcularValorFreteRemessa(100), 12.9);
    assert.equal(calcularValorFreteRemessa(6090), 41.78);
  });

  it("ICMS frete interestadual SP→SC usa 12%", () => {
    const icms = calcularIcmsFreteCte(41.78, "SP", "SC", 0);
    assert.equal(icms.pICMS, 12);
    assert.equal(icms.vICMS, 5.01);
  });

  it("buildCteFiscalPayload usa destinatário da NF-e e referência pela chave", () => {
    const fp = buildCteFiscalPayload(nfeRemessa, tenant);
    assert.equal(fp.nfeChaveRef, nfeRemessa.chave);
    assert.equal(fp.destinatario.endereco.codigoMunicipio, "4206009");
    assert.equal(fp.destinatario.ie, "261755994");
    assert.equal(fp.remetente.doc, "12345678000199");
    assert.equal(fp.rota.ufIni, "SP");
    assert.equal(fp.rota.ufFim, "SC");
    assert.equal(fp.rota.destino, "Governador Celso Ramos/SC");
  });

  it("resolveCteDocumento distingue remessa e venda consumidor", () => {
    assert.equal(resolveCteDocumento("remessa", 1).cfop, CTE_REMESSA_CFOP);
    assert.equal(resolveCteDocumento("venda", 9).cfop, CTE_VENDA_CFOP);
    assert.equal(resolveCteDocumento("venda", 1).cfop, CTE_REMESSA_CFOP);
  });

  it("resolveAliqIcmsFrete prioriza planilha tributária", () => {
    const taxRule = {
      aliquotaIcmsInterna: 18,
      icms: { pIcmsInternal: 18, pIcmsInterstate: 7 },
    };
    assert.equal(resolveAliqIcmsFrete("SP", "SP", 0, taxRule), 18);
    assert.equal(resolveAliqIcmsFrete("SP", "SC", 0, taxRule), 7);
  });
});
