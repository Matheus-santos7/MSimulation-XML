import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNFeXML,
} from "./nfe-xml-generator.js";
import type { EmitenteXml, NFeXmlInput, ProductXmlInput } from "./types.js";
import {
  enrichFiscalPayloadMlVenda,
  ML_NFE_VER_PROC,
  VENDA_ML_NAT_OP,
} from "@msimulation-xml/fiscal-core";
import { verifySimulationXmlSignature } from "@msimulation-xml/fiscal-core";

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

describe("buildNFeXML — VENDA", () => {
  it("alinha estrutura ML: natOp, verProc, autXML, CFOP, vFrete, xPed e nFCI", () => {
    const nfe: NFeXmlInput = {
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

    const xml = buildNFeXML(nfe, emit, product);
    assert.match(xml, /<natOp>Venda de mercadorias<\/natOp>/);
    assert.match(xml, new RegExp(`<verProc>${ML_NFE_VER_PROC}<\\/verProc>`));
    assert.match(xml, /<autXML>\s*<CPF>07116024921<\/CPF>\s*<\/autXML>/);
    assert.match(xml, /<CFOP>5105<\/CFOP>/);
    assert.match(xml, /<vFrete>55\.99<\/vFrete>/);
    assert.match(xml, /<xPed>200001579233992<\/xPed>/);
    assert.match(xml, /<nFCI>A7B816FF-59CC-41D9-97C1-B39BCED07B17<\/nFCI>/);
    assert.match(xml, /<vItem>815\.86<\/vItem>/);
    assert.match(xml, /<imposto>\s*<vTotTrib>289\.96<\/vTotTrib>/);
    assert.match(xml, /<vTotTrib>289\.96<\/vTotTrib>/);
    assert.match(xml, /<infAdProd>[^<]*289,96<\/infAdProd>/);
    assert.match(xml, /<pIPI>2\.6000<\/pIPI>/);
    assert.match(xml, /<gIBSUF><pIBSUF>0\.10<\/pIBSUF><vIBSUF>0\.63<\/vIBSUF><\/gIBSUF>/);
    assert.match(xml, /<vBCIBSCBS>632\.91<\/vBCIBSCBS>/);
    assert.match(xml, /<vNFTot>815\.86<\/vNFTot>/);
    assert.match(xml, /<transporta>\s*<CNPJ>03007331012239<\/CNPJ>/);
    assert.match(xml, /<tPag>03<\/tPag>/);
    assert.match(xml, /<vPag>894\.52<\/vPag>/);
    assert.match(xml, /<card>\s*<tpIntegra>1<\/tpIntegra>/);
    assert.match(xml, /<infCpl>Enviado diretamente do deposito temporario/);
    assert.match(xml, /<infRespTec>/);
    assert.match(xml, /<hashCSRT>\+TuKUMc7ueWv9UiYNVaTD\+ym1a4=<\/hashCSRT>/);
    assert.doesNotMatch(xml, /<CFOP><\/CFOP>/);
    assert.equal(verifySimulationXmlSignature(xml), true);
  });

  it("resolve CFOP 5105 quando nfe.cfop está vazio (intra + não contribuinte)", () => {
    const nfe: NFeXmlInput = {
      chave: "41260678242849000169550050000000051423282896",
      numero: 5,
      serie: 5,
      natOp: VENDA_ML_NAT_OP,
      cfop: "",
      ncm: "73211100",
      destinatario: {
        nome: "Comprador",
        doc: "07629167962",
        uf: "PR",
        indIEDest: 9,
        endereco: {
          logradouro: "Rua A",
          numero: "1",
          bairro: "Centro",
          codigoMunicipio: "4107207",
          municipio: "Dois Vizinhos",
          uf: "PR",
          cep: "85660000",
          codigoPais: 1058,
          nomePais: "Brasil",
        },
      },
      valor: 100,
      valorICMS: 0,
      aliqICMS: 0,
      status: "AUTORIZADA",
      emitidaEm: "2026-06-13T15:57:40-03:00",
      pedidoML: "ML-1",
      quantidade: 1,
      tipo: "VENDA",
      fiscalPayload: {
        engine: {
          itens: [
            {
              vProd: 100,
              quantidade: 1,
              valorUnitario: 100,
              icms: { cst: "00", orig: 0, vBC: 100, pICMS: 0, vICMS: 0 },
              pis: { cst: "01", vBC: 100, pPIS: 1.65, vPIS: 0 },
              cofins: { cst: "01", vBC: 100, pCOFINS: 7.6, vCOFINS: 0 },
            },
          ],
          totais: { vBC: 100, vICMS: 0, vProd: 100, vIPI: 0, vPIS: 0, vCOFINS: 0, vNF: 100 },
        },
      },
    };

    const xml = buildNFeXML(nfe, emit, product);
    assert.match(xml, /<CFOP>5105<\/CFOP>/);
  });

  it("emite ICMSUFDest e idDest=2 em venda interestadual com DIFAL no engine", () => {
    const nfe: NFeXmlInput = {
      chave: "42260678242849000169550050000000061423282897",
      numero: 6,
      serie: 5,
      natOp: VENDA_ML_NAT_OP,
      cfop: "6105",
      ncm: "85094010",
      destinatario: {
        nome: "Comprador Interestadual",
        doc: "07629167962",
        uf: "SP",
        indIEDest: 9,
        docTipo: "CPF",
        endereco: {
          logradouro: "Rua B",
          numero: "10",
          bairro: "Centro",
          codigoMunicipio: "3550308",
          municipio: "Sao Paulo",
          uf: "SP",
          cep: "01001000",
          codigoPais: 1058,
          nomePais: "Brasil",
        },
      },
      valor: 500,
      valorICMS: 21,
      aliqICMS: 4,
      status: "AUTORIZADA",
      emitidaEm: "2026-06-13T15:57:40-03:00",
      pedidoML: "46766952869",
      quantidade: 1,
      tipo: "VENDA",
      fiscalPayload: enrichFiscalPayloadMlVenda(
        {
          ufSaidaFisica: "SC",
          engine: {
            itens: [
              {
                vProd: 500,
                vFrete: 25,
                quantidade: 1,
                valorUnitario: 500,
                icms: { cst: "00", orig: 2, vBC: 538.75, pICMS: 4, vICMS: 21.55 },
                ipi: { cst: "50", cEnq: "999", vBC: 525, pIPI: 2.6, vIPI: 13.65 },
                pis: { cst: "01", vBC: 420.5, pPIS: 1.65, vPIS: 6.94 },
                cofins: { cst: "01", vBC: 420.5, pCOFINS: 7.6, vCOFINS: 31.96 },
                difal: {
                  vBCUFDest: 538.75,
                  pICMSUFDest: 19.5,
                  pICMSInter: 4,
                  pICMSInterPart: 100,
                  vICMSUFDest: 83.48,
                  vICMSUFRemet: 0,
                  pFCPUFDest: 0,
                  vFCPUFDest: 0,
                },
              },
            ],
            totais: {
              vBC: 538.75,
              vICMS: 21.55,
              vProd: 500,
              vFrete: 25,
              vIPI: 13.65,
              vPIS: 6.94,
              vCOFINS: 31.96,
              vICMSUFDest: 83.48,
              vICMSUFRemet: 0,
              vFCPUFDest: 0,
              vNF: 538.75,
            },
          },
        },
        { quantidade: 1, valorFrete: 25, xPed: "200001579233993" },
      ),
    };

    const importedProduct: ProductXmlInput = {
      ...product,
      sku: "4133250001",
      nome: "Liquidificador Importado",
      ncm: "85094010",
      origem: 2,
    };

    const xml = buildNFeXML(nfe, emit, importedProduct);
    assert.match(xml, /<idDest>2<\/idDest>/);
    assert.match(xml, /<CFOP>6105<\/CFOP>/);
    assert.match(xml, /<pICMS>4\.0000<\/pICMS>/);
    assert.match(xml, /<ICMSUFDest>/);
    assert.match(xml, /<pICMSInter>4\.00<\/pICMSInter>/);
    assert.match(xml, /<pICMSInterPart>100\.00<\/pICMSInterPart>/);
    assert.match(xml, /<vICMSUFDest>83\.48<\/vICMSUFDest>/);
    assert.match(xml, /<infCpl>[^<]*DIFAL da UF destino R\$83,48/);
  });
});
