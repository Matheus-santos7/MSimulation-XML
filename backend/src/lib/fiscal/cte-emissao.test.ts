import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CTE_VENDA_CFOP } from "@msimulation-xml/fiscal-core";
import { montarDadosCteFromNfe } from "./cte-emissao.js";

const tenant = {
  id: "t1",
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
  serieCte: 1,
} as const;

const nfeVenda = {
  id: "nfe-venda",
  productId: null,
  chave: "35260612345678000199550010000000021000000021",
  valor: 1200,
  quantidade: 1,
  aliqIcms: 18,
  destNome: "Consumidor Teste",
  destDoc: "12345678901",
  destUf: "RJ",
  destIndIeDest: 9,
  destLogradouro: "Rua B",
  destNumero: "50",
  destComplemento: null,
  destBairro: "Copacabana",
  destCodigoMunicipio: "3304557",
  destMunicipio: "Rio de Janeiro",
  destCep: "22041080",
  tipo: "VENDA",
  fiscalPayload: null,
} as Parameters<typeof montarDadosCteFromNfe>[2];

const prismaStub = {
  product: {
    findFirst: async () => null,
  },
} as Parameters<typeof montarDadosCteFromNfe>[0];

describe("montarDadosCteFromNfe", () => {
  it("vincula venda e monta destinatário a partir da NF-e", async () => {
    const dados = await montarDadosCteFromNfe(prismaStub, tenant as never, nfeVenda, "venda", {
      serie: 1,
      numero: 42,
    });

    assert.equal(dados.nfeVendaId, "nfe-venda");
    assert.equal(dados.cfop, CTE_VENDA_CFOP);
    assert.equal(dados.fiscalPayload.nfeChaveRef, nfeVenda.chave);
    assert.equal(dados.fiscalPayload.destinatario.doc, "12345678901");
    assert.equal(dados.fiscalPayload.destinatario.endereco.uf, "RJ");
    assert.equal(dados.fiscalPayload.rota.ufFim, "RJ");
    assert.equal(dados.chave.length, 44);
    assert.ok(dados.valor >= 12.9);
  });
});
