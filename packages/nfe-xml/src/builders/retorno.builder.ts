/**
 * Builder Strategy para NF-e de Retorno Simbólico (`RETORNO_SIMBOLICO`).
 *
 * Espelha `buildRetornoNFeXML` em `nfe-xml-generator.ts` (legado), reutilizando
 * a lógica de item/tributos da remessa com `tpNF=0` (entrada).
 *
 * @module builders/retorno.builder
 */

import { buildFulfillmentInfCplText } from "@msimulation-xml/fiscal-core";
import type { XmlObject } from "../core/xml-serializer.js";
import type { IdeBuildOptions, NFeBuilderInput } from "./builder.types.js";
import { buildInfAdicNode } from "./nodes/auxiliary.node.js";
import { retornoIdeOptions } from "./nodes/ide.node.js";
import { RemessaNFeStrategyBuilder } from "./remessa.builder.js";

/**
 * Estratégia concreta para retorno simbólico de depósito temporário (ML fulfillment).
 */
export class RetornoSimbolicoNFeStrategyBuilder extends RemessaNFeStrategyBuilder {
  protected getIdeOptions(): IdeBuildOptions {
    const e = this.ctx.emit.endereco;
    const d = this.ctx.nfe.destinatario;
    return retornoIdeOptions(e.uf, d.endereco.uf);
  }

  protected buildInfAdic(): XmlObject | null {
    const d = this.ctx.nfe.destinatario;
    const operation =
      this.ctx.nfe.tipo === "RETORNO_FISICO" ? "RETORNO_FISICO" : "RETORNO_SIMBOLICO";
    return buildInfAdicNode({
      nfe: this.ctx.nfe,
      emitter: this.ctx.emitter,
      extraInfCpl: buildFulfillmentInfCplText({
        operation,
        ufDestino: d.endereco.uf || d.uf,
        cnpjFilial: d.doc,
        middle: null,
      }),
    });
  }
}

/** Atalho funcional — retorna AST `nfeProc` de retorno simbólico. */
export function buildRetornoNFeProcDocument(input: NFeBuilderInput) {
  return new RetornoSimbolicoNFeStrategyBuilder(input).build();
}

/** Atalho funcional — retorna XML de retorno simbólico via Strategy builder. */
export function buildRetornoNFeXml(input: NFeBuilderInput): string {
  return new RetornoSimbolicoNFeStrategyBuilder(input).buildXml();
}
