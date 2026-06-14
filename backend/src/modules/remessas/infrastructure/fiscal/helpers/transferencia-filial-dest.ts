import type { TenantFilial } from "../../../../../generated/prisma/client.js";

export const TRANSFERENCIA_FILIAL_NAT_OP = "Transferencia para estabelecimento filial";
/** Interestadual — 1º dígito 6 (ex.: RJ → SP). */
export const TRANSFERENCIA_CFOP_INTERSTATE = "6152";
/** Intrastadual — 1º dígito 5. */
export const TRANSFERENCIA_CFOP_INTRASTATE = "5152";

export type FilialDestinoFiscal = {
  nome: string;
  cnpj: string;
  uf: string;
  ie: string;
  indIeDest: 1;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  cep: string;
  codigoPais: number;
  nomePais: string;
  telefone?: string;
};

/** CFOP da transferência interna conforme UF matriz × UF filial. */
export function resolveTransferenciaCfop(emitUf: string, destUf: string): string {
  return emitUf.toUpperCase().trim() === destUf.toUpperCase().trim()
    ? TRANSFERENCIA_CFOP_INTRASTATE
    : TRANSFERENCIA_CFOP_INTERSTATE;
}

export function filialParaDestinoFiscal(filial: TenantFilial): FilialDestinoFiscal {
  return {
    nome: filial.razaoSocial,
    cnpj: filial.cnpj.replace(/\D/g, ""),
    uf: filial.uf.toUpperCase(),
    ie: filial.ie.replace(/\D/g, ""),
    indIeDest: 1,
    logradouro: filial.logradouro,
    numero: filial.numero,
    complemento: filial.complemento ?? undefined,
    bairro: filial.bairro,
    codigoMunicipio: filial.codigoMunicipio,
    municipio: filial.municipio,
    cep: filial.cep.replace(/\D/g, ""),
    codigoPais: 1058,
    nomePais: "Brasil",
    telefone: filial.telefone ?? undefined,
  };
}

export function destinoFiscalToNfeFields(destino: FilialDestinoFiscal) {
  return {
    destNome: destino.nome,
    destDoc: destino.cnpj,
    destUf: destino.uf,
    destLogradouro: destino.logradouro,
    destNumero: destino.numero,
    destComplemento: destino.complemento,
    destBairro: destino.bairro,
    destCodigoMunicipio: destino.codigoMunicipio,
    destMunicipio: destino.municipio,
    destCep: destino.cep,
    destCodigoPais: destino.codigoPais,
    destNomePais: destino.nomePais,
    destIndIeDest: destino.indIeDest,
  };
}
