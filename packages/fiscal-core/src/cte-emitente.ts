/**
 * Emitente do CT-e (transportador ML / filial Ebazar no CD).
 *
 * @module cte-emitente
 */

import { CTE_ML_EMIT } from "./cte-template.js";

/** Dados fiscais do emitente do CT-e (grupo `<emit>`). */
export type CteEmitente = {
  cnpj: string;
  ie: string;
  nome: string;
  logradouro: string;
  numero: string;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
};

/** Entrada mínima de unidade logística ML para mapear emitente CT-e. */
export type CteEmitenteUnitInput = {
  cnpj: string;
  ie?: string | null;
  destNomeFiscal?: string | null;
  nome?: string | null;
  logradouro: string;
  numero: string;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizeEmitenteNome(value: string): string {
  return value.replace(/\./g, "").trim().toUpperCase();
}

/**
 * Mapeia unidade logística ML (CD) para emitente do CT-e.
 */
export function mapLogisticsUnitToCteEmitente(unit: CteEmitenteUnitInput): CteEmitente {
  const rawNome = unit.destNomeFiscal?.trim() || unit.nome?.trim() || CTE_ML_EMIT.nome;
  return {
    cnpj: digitsOnly(unit.cnpj).padStart(14, "0").slice(-14),
    ie: digitsOnly(unit.ie ?? ""),
    nome: normalizeEmitenteNome(rawNome),
    logradouro: unit.logradouro.trim(),
    numero: unit.numero.trim() || "S/N",
    bairro: unit.bairro.trim() || "Nao informado",
    codigoMunicipio: digitsOnly(unit.codigoMunicipio).padStart(7, "0").slice(-7),
    municipio: unit.municipio.trim(),
    uf: unit.uf.trim().toUpperCase().slice(0, 2),
    cep: digitsOnly(unit.cep).padStart(8, "0").slice(-8),
  };
}

/** Fallback histórico (filial RJ) quando não há CD elegível. */
export function defaultCteEmitente(): CteEmitente {
  return { ...CTE_ML_EMIT };
}

/**
 * Indica se a remessa seller→CD permite emitir CT-e com o CD como transportador.
 * Regra: saída do seller e CD na mesma UF.
 */
export function remessaUsesCdAsCteEmitente(sellerUf: string, cdUf: string): boolean {
  return sellerUf.trim().toUpperCase() === cdUf.trim().toUpperCase();
}
