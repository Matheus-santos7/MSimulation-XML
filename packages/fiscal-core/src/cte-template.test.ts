import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCteFiscalPayload,
  calcularIbsCbsFreteCte,
  calcularIcmsFreteCte,
  calcularValorFreteRemessa,
  CTE_REMESSA_CFOP,
  CTE_VENDA_CFOP,
  resolveAliqIcmsFrete,
  resolveCteDocumento,
} from "./cte-template.js";
import { mapLogisticsUnitToCteEmitente } from "./cte-emitente.js";

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

  it("IBS/CBS do frete segue base vPrest − ICMS − PIS − COFINS (exemplo ML)", () => {
    const icms = calcularIcmsFreteCte(7.75, "SP", "SP", 0);
    assert.equal(icms.vICMS, 0.93);
    const ibsCbs = calcularIbsCbsFreteCte(7.75, icms);
    assert.equal(ibsCbs.vPIS, 0.11);
    assert.equal(ibsCbs.vCOFINS, 0.52);
    assert.equal(ibsCbs.vBC, 6.19);
    assert.equal(ibsCbs.vIBSUF, 0.01);
    assert.equal(ibsCbs.vCBS, 0.06);
    assert.equal(ibsCbs.vTotDFe, 7.75);
  });

  it("buildCteFiscalPayload usa frete informado e calcula tributos sobre ele", () => {
    const fp = buildCteFiscalPayload(nfeRemessa, tenant, { vFrete: 7.75 });
    assert.equal(fp.icms.vICMS, 0.93);
    assert.equal(fp.ibsCbs.vBC, 6.19);
    assert.equal(fp.ibsCbs.vCBS, 0.06);
  });

  it("buildCteFiscalPayload venda usa município do emitente na rota", () => {
    const emitente = mapLogisticsUnitToCteEmitente({
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
    const fp = buildCteFiscalPayload(
      {
        ...nfeRemessa,
        destUf: "SP",
        destCodigoMunicipio: "3550308",
        destMunicipio: "Sao Paulo",
      },
      tenant,
      { vFrete: 7.75, emitente, vinculo: "venda" },
    );
    assert.equal(fp.rota.cMunIni, "3509205");
    assert.equal(fp.rota.ufIni, "SP");
    assert.equal(fp.rota.origem, "Cajamar/SP");
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
