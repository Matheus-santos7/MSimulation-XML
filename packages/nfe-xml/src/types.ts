/** Tipos mínimos para geração de XML — alinhados aos DTOs da API. */

export type FiscalStatusXml = "AUTORIZADA" | "REJEITADA" | "CANCELADA" | "DENEGADA" | string;

export type NFeTipoXml =
  | "VENDA"
  | "REMESSA"
  | "RETORNO_SIMBOLICO"
  | "DEVOLUCAO"
  | "REMESSA_SIMBOLICA";

export type DestinatarioXml = {
  nome: string;
  doc: string;
  uf: string;
  indIEDest: number;
  docTipo?: "CNPJ" | "CPF";
  endereco: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    codigoMunicipio: string;
    municipio: string;
    uf: string;
    cep: string;
    codigoPais: number;
    nomePais: string;
    telefone?: string;
  };
};

export type NFeXmlInput = {
  id?: string;
  chave: string;
  numero: number;
  serie: number;
  natOp: string;
  cfop: string;
  ncm: string;
  destinatario: DestinatarioXml;
  valor: number;
  valorICMS: number;
  aliqICMS: number;
  status: FiscalStatusXml;
  emitidaEm: string;
  pedidoML: string;
  quantidade: number;
  tipo: NFeTipoXml;
  nfeReferenciaChave?: string;
  fiscalPayload?: Record<string, unknown>;
};

export type EmitenteXml = {
  cnpj: string;
  xNome: string;
  xFant: string;
  ie: string;
  iest?: string;
  crt: number;
  uf: string;
  endereco: {
    xLgr: string;
    nro: string;
    xCpl?: string;
    xBairro: string;
    cMun: string;
    xMun: string;
    uf: string;
    cep: string;
    cPais: number;
    xPais: string;
    fone?: string;
  };
};

import type { ProductPricesDto } from "@msimulation-xml/fiscal-core";

/** Produto para tags `<prod>` — compatível com `productUnitPriceForNfe`. */
export type ProductXmlInput = ProductPricesDto & {
  sku?: string;
  ean?: string;
  nome?: string;
  ncm?: string;
  cest?: string;
  exTipi?: string;
  origem?: number;
  unidade?: string;
};

export type FiscalEventoXmlInput = {
  protocolo: string;
  ocorridoEm: string;
  xJust?: string;
};
