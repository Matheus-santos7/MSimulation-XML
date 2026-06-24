import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ML_NFE_VER_PROC,
  VENDA_ML_NAT_OP,
  enrichFiscalPayloadMlVenda,
  verifySimulationXmlSignature,
} from "@msimulation-xml/fiscal-core";
import {
  NFE_BUILDER_SUPPORTED,
  UnsupportedNfeBuilderTipoError,
  buildNFeProcDocument,
  buildNFeXmlFromBuilder,
  createNFeBuilder,
  isNfeBuilderSupported,
} from "../core/nfe-factory.js";
import { RetornoSimbolicoNFeStrategyBuilder } from "./retorno.builder.js";
import { VendaNFeStrategyBuilder } from "./venda.builder.js";
import type { EmitenteXml, NFeXmlInput, ProductXmlInput } from "../types.js";

const emit: EmitenteXml = {
  cnpj: "78242849000169",
  xNome: "ATLAS INDUSTRIA DE ELETRODOMESTICOS LTDA.",
  xFant: "ATLAS ELETRODOMESTICOS",
  ie: "3160442394",
  crt: 3,
  uf: "PR",
  endereco: {
    xLgr: "BR-158",
    nro: "SN",
    xCpl: "KM: 508;",
    xBairro: "INDUSTRIAL",
    cMun: "4118501",
    xMun: "PATO BRANCO",
    uf: "PR",
    cep: "85504670",
    cPais: 1058,
    xPais: "Brasil",
    fone: "4637711500",
  },
};

const product: ProductXmlInput = {
  sku: "300002137",
  nome: "Fogao 4 Bocas",
  ncm: "73211100",
  cest: "2100100",
  exTipi: "01",
  unidade: "UNID",
  origem: 5,
  preco: 815.86,
  nfci: "A7B816FF-59CC-41D9-97C1-B39BCED07B17",
};

function sampleVendaNfe(): NFeXmlInput {
  return {
    chave: "41260678242849000169550050000000051423282896",
    numero: 5,
    serie: 5,
    natOp: VENDA_ML_NAT_OP,
    cfop: "5105",
    ncm: "73211100",
    destinatario: {
      nome: "Daiane Aparecida dos santos",
      doc: "07629167962",
      uf: "PR",
      indIEDest: 9,
      docTipo: "CPF",
      endereco: {
        logradouro: "Rua Elizario Castanha",
        numero: "61",
        bairro: "Centro",
        codigoMunicipio: "4107207",
        municipio: "Dois Vizinhos",
        uf: "PR",
        cep: "85660000",
        codigoPais: 1058,
        nomePais: "Brasil",
      },
    },
    valor: 815.86,
    valorICMS: 174.43,
    aliqICMS: 19.5,
    status: "AUTORIZADA",
    emitidaEm: "2026-06-13T15:57:40-03:00",
    pedidoML: "46766952868",
    quantidade: 1,
    tipo: "VENDA",
    nfeReferenciaChave: "41260678242849000169550050000000041410852632",
    fiscalPayload: enrichFiscalPayloadMlVenda(
      {
        autXmlCpfs: ["07116024921", "05168151990"],
        xPed: "200001579233992",
        valorFrete: 55.99,
        engine: {
          itens: [
            {
              vProd: 815.86,
              vFrete: 55.99,
              quantidade: 1,
              valorUnitario: 815.86,
              icms: { cst: "00", orig: 5, vBC: 894.52, pICMS: 19.5, vICMS: 174.43 },
              ipi: { cst: "50", cEnq: "999", vBC: 871.85, pIPI: 2.6, vIPI: 22.67 },
              pis: { cst: "01", vBC: 697.42, pPIS: 1.65, vPIS: 11.51 },
              cofins: { cst: "01", vBC: 697.42, pCOFINS: 7.6, vCOFINS: 53.0 },
            },
          ],
          totais: {
            vBC: 894.52,
            vICMS: 174.43,
            vProd: 815.86,
            vFrete: 55.99,
            vIPI: 22.67,
            vPIS: 11.51,
            vCOFINS: 53.0,
            vNF: 894.52,
          },
        },
      },
      {
        quantidade: 1,
        valorFrete: 55.99,
        xPed: "200001579233992",
        vTotTrib: 289.96,
        returnNote: { numero: 4, serie: 5, emitidaEm: "2026-06-13T12:00:00-03:00" },
      },
    ),
  };
}

describe("nfe-factory — Strategy builders", () => {
  it("expõe tipos suportados pelo builder Strategy", () => {
    assert.deepEqual(NFE_BUILDER_SUPPORTED, [
      "VENDA",
      "REMESSA",
      "REMESSA_SIMBOLICA",
      "REMESSA_AVANCO",
      "TRANSFERENCIA_FILIAL",
      "RETORNO_SIMBOLICO",
      "DEVOLUCAO",
    ]);
    assert.equal(isNfeBuilderSupported("VENDA"), true);
    assert.equal(isNfeBuilderSupported("RETORNO_SIMBOLICO"), true);
    assert.equal(isNfeBuilderSupported("DEVOLUCAO"), true);
  });

  it("createNFeBuilder retorna VendaNFeStrategyBuilder para VENDA", () => {
    const builder = createNFeBuilder({ nfe: sampleVendaNfe(), emit, product });
    assert.ok(builder instanceof VendaNFeStrategyBuilder);
  });

  it("createNFeBuilder retorna RetornoSimbolicoNFeStrategyBuilder para RETORNO_SIMBOLICO", () => {
    const nfe = { ...sampleVendaNfe(), tipo: "RETORNO_SIMBOLICO" as const };
    const builder = createNFeBuilder({ nfe, emit, product });
    assert.ok(builder instanceof RetornoSimbolicoNFeStrategyBuilder);
  });

  it("buildNFeProcDocument retorna estrutura nfeProc com ide, det e pag", () => {
    const doc = buildNFeProcDocument({ nfe: sampleVendaNfe(), emit, product });
    const infNFe = doc.root.nfeProc.NFe.infNFe;
    assert.equal(infNFe.ide.verProc, ML_NFE_VER_PROC);
    assert.equal(infNFe.ide.indFinal, 1);
    assert.ok(infNFe.det);
    assert.ok(infNFe.pag);
    assert.ok(doc.root.nfeProc.protNFe);
  });

  it("buildNFeXmlFromBuilder gera XML assinável equivalente ao legado para venda ML", () => {
    const xml = buildNFeXmlFromBuilder({ nfe: sampleVendaNfe(), emit, product });
    assert.match(xml, /<natOp>Venda de mercadorias<\/natOp>/);
    assert.match(xml, new RegExp(`<verProc>${ML_NFE_VER_PROC}<\\/verProc>`));
    assert.match(xml, /<vFrete>55\.99<\/vFrete>/);
    assert.match(xml, /<vPag>894\.52<\/vPag>/);
    assert.match(xml, /<infRespTec>/);
    assert.equal(verifySimulationXmlSignature(xml), true);
  });
});

describe("VendaNFeStrategyBuilder", () => {
  it("build() retorna objeto antes da serialização", () => {
    const builder = new VendaNFeStrategyBuilder({ nfe: sampleVendaNfe(), emit, product });
    const doc = builder.build();
    assert.equal(doc.root.nfeProc["@versao"], "4.00");
    const det = doc.root.nfeProc.NFe.infNFe.det;
    const firstDet = Array.isArray(det) ? det[0] : det;
    assert.equal(firstDet?.prod?.CFOP, "5106");
  });
});
