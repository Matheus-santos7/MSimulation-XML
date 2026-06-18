/**
 * Builder Strategy para NF-e de Devolução (`DEVOLUCAO`).
 *
 * Espelha `buildDevolucaoNFeXML` no gerador legado: mesma estrutura da venda,
 * com `tpNF=0` (entrada) e `finNFe=4` (devolução).
 *
 * @module builders/devolucao.builder
 */

import type { IdeBuildOptions, NFeBuilderInput } from "./builder.types.js";
import { devolucaoIdeOptions } from "./nodes/ide.node.js";
import { VendaNFeStrategyBuilder } from "./venda.builder.js";

/**
 * Estratégia concreta para NF-e de devolução referenciando venda autorizada.
 */
export class DevolucaoNFeStrategyBuilder extends VendaNFeStrategyBuilder {
  protected getIdeOptions(): IdeBuildOptions {
    const d = this.ctx.nfe.destinatario;
    return {
      ...devolucaoIdeOptions(this.vendaCtx.stockUf, d.endereco.uf),
      idDest: this.vendaCtx.idDest,
    };
  }
}

/** Atalho funcional — retorna AST `nfeProc` de devolução. */
export function buildDevolucaoNFeProcDocument(input: NFeBuilderInput) {
  return new DevolucaoNFeStrategyBuilder(input).build();
}

/** Atalho funcional — retorna XML de devolução via Strategy builder. */
export function buildDevolucaoNFeXml(input: NFeBuilderInput): string {
  return new DevolucaoNFeStrategyBuilder(input).buildXml();
}
