/**
 * Composer de `<infAdic><infCpl>` — fulfillment EBazar / ML Full.
 * Spec: docs/specs/infcpl-fulfillment-ebazar.md
 */

import { resolveRegimeEspecial } from "./fulfillment-infcpl.regimes.js";

export type FulfillmentInfCplOperation =
  | "REMESSA"
  | "REMESSA_SIMBOLICA"
  | "RETORNO_SIMBOLICO"
  | "RETORNO_FISICO"
  | "VENDA_FULFILLMENT"
  | "TRANSFERENCIA"
  | "DEVOLUCAO"
  | "INSULCESSO_DE_ENTREGA";

export type FulfillmentInfCplNfeOrigem = {
  numero: number;
  serie: number;
  emitidaEm: Date | string;
};

export type FulfillmentInfCplInput = {
  operation: FulfillmentInfCplOperation;
  ufDestino: string;
  cnpjFilial: string;
  /** Miolo (IE, CD, impostos, refs). Sem a abertura de operação. */
  middle?: string | null;
  /** Obrigatório para DEVOLUCAO / INSULCESSO_DE_ENTREGA. */
  nfeOrigem?: FulfillmentInfCplNfeOrigem;
};

const OPERATION_HEAD: Record<
  Exclude<FulfillmentInfCplOperation, "DEVOLUCAO" | "INSULCESSO_DE_ENTREGA">,
  string
> = {
  REMESSA: "Remessa para armazenamento em fulfillment.",
  REMESSA_SIMBOLICA: "Remessa simbolica para armazenamento em fulfillment.",
  RETORNO_SIMBOLICO: "Retorno simbolico de mercadoria armazenada em fulfillment.",
  RETORNO_FISICO: "Retorno fisico de mercadoria armazenada em fulfillment.",
  VENDA_FULFILLMENT: "Venda de mercadoria armazenada em fulfillment.",
  TRANSFERENCIA: "Transferencia de mercadoria para estabelecimento de fulfillment.",
};

/** Data dd/mm/aaaa no fuso America/Sao_Paulo. */
export function formatInfCplDateBr(input: Date | string): string {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    throw new Error("Data de emissão inválida para infCpl.");
  }
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function resolveOperationText(input: FulfillmentInfCplInput): string {
  if (input.operation === "DEVOLUCAO" || input.operation === "INSULCESSO_DE_ENTREGA") {
    const origem = input.nfeOrigem;
    const n = origem?.numero;
    const serie = origem?.serie;
    if (
      origem == null ||
      !Number.isFinite(n) ||
      !Number.isFinite(serie) ||
      n! <= 0 ||
      serie! < 0 ||
      !origem.emitidaEm
    ) {
      throw new Error(
        `infCpl ${input.operation} exige nfeOrigem com numero, serie e emitidaEm válidos.`,
      );
    }
    const data = formatInfCplDateBr(origem.emitidaEm);
    const prefix =
      input.operation === "DEVOLUCAO"
        ? "Devolucao de mercadoria referente a NF-e de origem"
        : "Insucesso de entrega de mercadoria referente a NF-e de origem";
    return `${prefix} n ${n} serie ${serie} emitida em ${data}.`;
  }
  return OPERATION_HEAD[input.operation];
}

/** Texto de negócio para `<infCpl>`: `{head} {middle?} {regime?}`. */
export function buildFulfillmentInfCplText(input: FulfillmentInfCplInput): string {
  const head = resolveOperationText(input);
  const middle = input.middle?.trim() ?? "";
  const regime = resolveRegimeEspecial(input.ufDestino, input.cnpjFilial) ?? "";
  return [head, middle, regime].filter(Boolean).join(" ");
}

/** Miolo padrão de remessa / transferência: IE do operador logístico. */
export function buildRemessaIeMiddle(destIe?: string | null): string {
  const ie = destIe?.replace(/\D/g, "").trim() ?? "";
  if (!ie) return "";
  return `Inscricao Estadual do Operador Logistico: ${ie}.`;
}

/** Ref. de NF-e de devolução no miolo da remessa simbólica pós-devolução. */
export function buildPosDevolucaoMiddle(origem: FulfillmentInfCplNfeOrigem): string {
  const numero = Number(origem.numero);
  const serie = Number(origem.serie);
  if (!Number.isFinite(numero) || !Number.isFinite(serie) || numero <= 0 || serie < 0) {
    throw new Error("buildPosDevolucaoMiddle exige numero e serie numéricos válidos.");
  }
  const data = formatInfCplDateBr(origem.emitidaEm);
  return `Nota fiscal de devolucao n ${numero} emitida em ${data} serie ${serie}.`;
}
