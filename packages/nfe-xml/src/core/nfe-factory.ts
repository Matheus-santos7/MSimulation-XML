/**
 * Factory de builders NF-e — seleção de estratégia por `tipo`.
 *
 * @module core/nfe-factory
 */

import type { FiscalEmitterSettingsData } from "@msimulation-xml/fiscal-core";
import { BaseNFeBuilder } from "../builders/base-nfe.builder.js";
import type { NFeBuilderInput } from "../builders/builder.types.js";
import { DevolucaoNFeStrategyBuilder } from "../builders/devolucao.builder.js";
import { RemessaNFeStrategyBuilder } from "../builders/remessa.builder.js";
import { RetornoSimbolicoNFeStrategyBuilder } from "../builders/retorno.builder.js";
import { VendaNFeStrategyBuilder } from "../builders/venda.builder.js";
import type { NfeProcDocument } from "./nfe-ast.types.js";
import type { EmitenteXml, NFeTipoXml, NFeXmlInput, ProductXmlInput } from "../types.js";

/** Tipos suportados pelos builders Strategy. */
export const NFE_BUILDER_SUPPORTED: readonly NFeTipoXml[] = [
  "VENDA",
  "REMESSA",
  "REMESSA_SIMBOLICA",
  "TRANSFERENCIA_FILIAL",
  "RETORNO_SIMBOLICO",
  "DEVOLUCAO",
];

export function isNfeBuilderSupported(tipo: NFeTipoXml): boolean {
  return (NFE_BUILDER_SUPPORTED as readonly string[]).includes(tipo);
}

/** Erro quando o tipo não possui builder Strategy implementado. */
export class UnsupportedNfeBuilderTipoError extends Error {
  readonly tipo: NFeTipoXml;

  constructor(tipo: NFeTipoXml) {
    super(`Builder Strategy ainda não implementado para NF-e tipo ${tipo}`);
    this.name = "UnsupportedNfeBuilderTipoError";
    this.tipo = tipo;
  }
}

export type NFeFactoryInput = {
  nfe: NFeXmlInput;
  emit: EmitenteXml;
  product?: ProductXmlInput;
  products?: ProductXmlInput[];
  emitterSettings?: FiscalEmitterSettingsData | null;
};

/**
 * Seleciona e instancia o builder Strategy adequado ao `tipo` da nota.
 *
 * @throws {UnsupportedNfeBuilderTipoError} para tipos ainda só no gerador legado
 */
export function createNFeBuilder(input: NFeFactoryInput): BaseNFeBuilder {
  const factoryInput: NFeBuilderInput = input;

  switch (input.nfe.tipo) {
    case "VENDA":
      return new VendaNFeStrategyBuilder(factoryInput);
    case "REMESSA":
    case "REMESSA_SIMBOLICA":
    case "TRANSFERENCIA_FILIAL":
      return new RemessaNFeStrategyBuilder(factoryInput);
    case "RETORNO_SIMBOLICO":
      return new RetornoSimbolicoNFeStrategyBuilder(factoryInput);
    case "DEVOLUCAO":
      return new DevolucaoNFeStrategyBuilder(factoryInput);
    default:
      throw new UnsupportedNfeBuilderTipoError(input.nfe.tipo);
  }
}

/** Monta documento AST `nfeProc` usando o builder Strategy correto. */
export function buildNFeProcDocument(input: NFeFactoryInput): NfeProcDocument {
  return createNFeBuilder(input).build();
}

/** Monta string XML NF-e usando o builder Strategy correto. */
export function buildNFeXmlFromBuilder(input: NFeFactoryInput): string {
  return createNFeBuilder(input).buildXml();
}
