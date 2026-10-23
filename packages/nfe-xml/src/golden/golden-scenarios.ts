/**
 * Cenários fixos dos XMLs de referência (golden files) do Mercado Livre.
 * Um cenário por tipo de NF-e. Mudar uma entrada aqui exige regravar os arquivos
 * (`UPDATE_GOLDEN=1`) e revisar o diff do XML.
 */
import { mercadoLivreProfile, type NFeTipoValue } from "@msimulation-xml/fiscal-core";
import type { EmitenteXml, NFeXmlInput, ProductXmlInput } from "../types.js";

export const goldenEmit: EmitenteXml = {
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

export const goldenProduct: ProductXmlInput = {
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

const CHAVE_REMESSA = "41260678242849000169550050000000011000000012";

const armazemMl = {
  nome: "EBAZAR.COM.BR LTDA",
  doc: "03007331012077",
  uf: "SC",
  indIEDest: 1,
  endereco: {
    logradouro: "Av. Papenborg",
    numero: "S/N",
    complemento: "Nao consta",
    bairro: "Guaporanga",
    codigoMunicipio: "4206009",
    municipio: "Governador Celso Ramos",
    uf: "SC",
    cep: "88195900",
    codigoPais: 1058,
    nomePais: "Brasil",
  },
} as const;

const consumidor = {
  nome: "Consumidor Teste",
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
} as const;

function engine(vProd: number, pICMS: number) {
  const vICMS = Math.round(vProd * pICMS) / 100;

  return {
    itens: [
      {
        vProd,
        quantidade: 1,
        valorUnitario: vProd,
        icms: { cst: "00", orig: 5, vBC: vProd, pICMS, vICMS },
        ipi: { cst: "55", cEnq: "103", vBC: 0, pIPI: 0, vIPI: 0 },
        pis: { cst: "09", vBC: 0, vPIS: 0 },
        cofins: { cst: "09", vBC: 0, vCOFINS: 0 },
      },
    ],
    totais: { vBC: vProd, vICMS, vProd, vIPI: 0, vPIS: 0, vCOFINS: 0, vNF: vProd },
  };
}

function fulfillmentNote(
  tipo: NFeTipoValue,
  numero: number,
  natOp: string,
  cfop: string,
  extra: Partial<NFeXmlInput> = {},
): NFeXmlInput {
  return {
    chave: `4126067824284900016955005${String(numero).padStart(9, "0")}1000000012`,
    numero,
    serie: 5,
    natOp,
    cfop,
    ncm: "73211100",
    destinatario: armazemMl,
    valor: 609,
    valorICMS: 73.08,
    aliqICMS: 12,
    status: "AUTORIZADA",
    emitidaEm: "2026-06-03T12:00:00-03:00",
    pedidoML: "ML-781050649173",
    quantidade: 1,
    tipo,
    fiscalPayload: mercadoLivreProfile.enrichFulfillmentPayload(
      { engine: engine(609, 12) },
      { quantidadeTotal: 1, destIe: "261755994", withLogistics: true },
    ),
    ...extra,
  } as NFeXmlInput;
}

const CHAVE_VENDA = "41260678242849000169550050000000071423282896";

function returnNote(tipo: NFeTipoValue, numero: number, natOp: string, cfop: string): NFeXmlInput {
  const base = fulfillmentNote(tipo, numero, natOp, cfop, { nfeReferenciaChave: CHAVE_VENDA });

  return {
    ...base,
    destinatario: consumidor,
    fiscalPayload: {
      ...base.fiscalPayload,
      nfeOrigem: { numero: 7, serie: 5, emitidaEm: "2026-06-13T15:57:40-03:00" },
    },
  } as NFeXmlInput;
}

export type GoldenScenario = { name: string; nfe: NFeXmlInput };

export const goldenScenarios: readonly GoldenScenario[] = [
  {
    name: "mercado-livre-remessa",
    nfe: fulfillmentNote("REMESSA", 1, "Remessa para deposito temporario", "6949"),
  },
  {
    name: "mercado-livre-remessa-simbolica",
    nfe: fulfillmentNote("REMESSA_SIMBOLICA", 2, "Remessa simbolica para deposito", "6949", {
      nfeReferenciaChave: CHAVE_REMESSA,
    }),
  },
  {
    name: "mercado-livre-remessa-avanco",
    nfe: fulfillmentNote("REMESSA_AVANCO", 3, "Remessa para deposito temporario", "6949"),
  },
  {
    name: "mercado-livre-retorno-simbolico",
    nfe: fulfillmentNote(
      "RETORNO_SIMBOLICO",
      4,
      "Outras Entradas - Retorno Simbolico de Deposito Temporario",
      "2949",
      { nfeReferenciaChave: CHAVE_REMESSA },
    ),
  },
  {
    name: "mercado-livre-retorno-fisico",
    nfe: fulfillmentNote("RETORNO_FISICO", 5, "Retorno de mercadoria depositada", "2949", {
      nfeReferenciaChave: CHAVE_REMESSA,
    }),
  },
  {
    name: "mercado-livre-transferencia-filial",
    nfe: fulfillmentNote("TRANSFERENCIA_FILIAL", 6, "Transferencia de mercadoria", "6152"),
  },
  {
    name: "mercado-livre-venda",
    nfe: {
      chave: "41260678242849000169550050000000071423282896",
      numero: 7,
      serie: 5,
      natOp: "Venda de mercadoria",
      cfop: "5105",
      ncm: "73211100",
      destinatario: consumidor,
      valor: 815.86,
      valorICMS: 174.43,
      aliqICMS: 19.5,
      status: "AUTORIZADA",
      emitidaEm: "2026-06-13T15:57:40-03:00",
      pedidoML: "46766952868",
      quantidade: 1,
      tipo: "VENDA",
      nfeReferenciaChave: CHAVE_REMESSA,
      fiscalPayload: mercadoLivreProfile.enrichVendaPayload(
        { engine: engine(815.86, 19.5) },
        { quantidade: 1, valorFrete: 55.99, xPed: "200001579233992", vTotTrib: 289.96 },
      ),
    } as NFeXmlInput,
  },
  {
    name: "mercado-livre-devolucao",
    nfe: returnNote("DEVOLUCAO", 8, "Devolucao de venda", "1202"),
  },
  {
    name: "mercado-livre-insucesso-de-entrega",
    nfe: returnNote("INSULCESSO_DE_ENTREGA", 9, "Retorno de mercadoria nao entregue", "1201"),
  },
];
