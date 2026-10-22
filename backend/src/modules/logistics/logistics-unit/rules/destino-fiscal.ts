import type { UnidadeLogistica } from "../../../../generated/prisma/client.js";

export type UnidadeDestinoFiscal = {
  nome: string;
  cnpj: string;
  ie: string | null;
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
  indIeDest: number;
};

/** Mapeia o CD cadastrado → destinatário (`<dest>`) da NF-e de remessa, avanço e retorno. */
export function unidadeParaDestinoFiscal(
  u: Pick<
    UnidadeLogistica,
    | "destNomeFiscal"
    | "cnpj"
    | "ie"
    | "logradouro"
    | "numero"
    | "complemento"
    | "bairro"
    | "codigoMunicipio"
    | "municipio"
    | "uf"
    | "cep"
    | "codigoPais"
    | "nomePais"
    | "indIeDest"
  >,
): UnidadeDestinoFiscal {
  return {
    nome: u.destNomeFiscal,
    cnpj: u.cnpj,
    ie: u.ie,
    logradouro: u.logradouro,
    numero: u.numero,
    complemento: u.complemento ?? undefined,
    bairro: u.bairro,
    codigoMunicipio: u.codigoMunicipio,
    municipio: u.municipio,
    uf: u.uf,
    cep: u.cep,
    codigoPais: u.codigoPais,
    nomePais: u.nomePais,
    indIeDest: u.indIeDest,
  };
}
