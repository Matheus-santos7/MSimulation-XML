import type { NFe } from "../../../../generated/prisma/client.js";
import {
  normalizeSymbolicReturnNatureza,
  resolveSymbolicInboundReturnCfop,
  type SymbolicReturnNatureza,
} from "@msimulation-xml/fiscal-core";

export const RETORNO_SIMBOLICO_CFOP_INTRA = "1949";
export const RETORNO_SIMBOLICO_CFOP_INTER = "2949";
export const RETORNO_SIMBOLICO_NAT_OP =
  "Outras Entradas - Retorno Simbolico de Deposito Temporario";

/** @deprecated Use `resolveRetornoSimbolicoCfop`. Mantido para imports legados. */
export const RETORNO_SIMBOLICO_CFOP = RETORNO_SIMBOLICO_CFOP_INTRA;

export type ResolveRetornoSimbolicoCfopOptions = {
  natureza?: SymbolicReturnNatureza | null;
  remessaCfop?: string | null;
};

/**
 * CFOP de retorno simbólico (allowlist ML dos 6 códigos).
 * Default preserva 1949/2949; remessa 5905/6905 → 1907/2907; settings podem forçar natureza.
 */
export function resolveRetornoSimbolicoCfop(
  emitUf: string,
  destUf: string,
  options?: ResolveRetornoSimbolicoCfopOptions,
): string {
  return resolveSymbolicInboundReturnCfop({
    emitUf,
    destUf,
    natureza: options?.natureza != null ? normalizeSymbolicReturnNatureza(options.natureza) : null,
    remessaCfop: options?.remessaCfop,
  }).cfop;
}

export type CamposDestinoRetorno = {
  destNome: string;
  destDoc: string;
  destUf: string;
  destLogradouro: string;
  destNumero: string;
  destComplemento: string | null;
  destBairro: string;
  destCodigoMunicipio: string;
  destMunicipio: string;
  destCep: string;
  destCodigoPais: number;
  destNomePais: string;
  destTelefone: string | null;
  destIndIeDest: number;
};

type RemessaDestFields = Pick<
  NFe,
  | "destNome"
  | "destDoc"
  | "destUf"
  | "destLogradouro"
  | "destNumero"
  | "destComplemento"
  | "destBairro"
  | "destCodigoMunicipio"
  | "destMunicipio"
  | "destCep"
  | "destCodigoPais"
  | "destNomePais"
  | "destTelefone"
  | "destIndIeDest"
  | "fiscalPayload"
>;

export type RemessaDestUnidade = {
  ie: string | null;
  codigoMunicipio?: string | null;
  municipio?: string | null;
  bairro?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  cep?: string | null;
} | null;

function pickNonEmpty(primary: string | null | undefined, fallback?: string | null): string {
  const normalized = primary?.trim() ?? "";
  if (normalized) return normalized;
  return fallback?.trim() ?? "";
}

/** Destinatário do retorno = mesmo CD ML da remessa FIFO referenciada (padrão XMLs produção). */
export function destinoRetornoFromRemessa(
  remessa: RemessaDestFields,
  unidadeDestino?: RemessaDestUnidade,
): CamposDestinoRetorno {
  return {
    destNome: remessa.destNome,
    destDoc: remessa.destDoc,
    destUf: remessa.destUf,
    destLogradouro: pickNonEmpty(remessa.destLogradouro, unidadeDestino?.logradouro),
    destNumero: pickNonEmpty(remessa.destNumero, unidadeDestino?.numero),
    destComplemento: remessa.destComplemento ?? unidadeDestino?.complemento ?? null,
    destBairro: pickNonEmpty(remessa.destBairro, unidadeDestino?.bairro),
    destCodigoMunicipio: pickNonEmpty(
      remessa.destCodigoMunicipio,
      unidadeDestino?.codigoMunicipio,
    ),
    destMunicipio: pickNonEmpty(remessa.destMunicipio, unidadeDestino?.municipio),
    destCep: pickNonEmpty(remessa.destCep, unidadeDestino?.cep),
    destCodigoPais: remessa.destCodigoPais,
    destNomePais: remessa.destNomePais,
    destTelefone: remessa.destTelefone,
    destIndIeDest: remessa.destIndIeDest,
  };
}

export function destIeRetornoFromRemessa(
  remessa: Pick<RemessaDestFields, "fiscalPayload">,
  unidadeDestino?: RemessaDestUnidade,
): string | undefined {
  const fp = remessa.fiscalPayload as Record<string, unknown> | undefined;
  const fromPayload = typeof fp?.destIe === "string" ? fp.destIe : undefined;
  const fromUnidade = unidadeDestino?.ie;
  const raw = fromPayload || fromUnidade || "";
  const digits = String(raw).replace(/\D/g, "");
  return digits || undefined;
}
