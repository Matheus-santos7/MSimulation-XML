/**
 * Builder Strategy para NF-e de Devolução (`DEVOLUCAO`) e Insucesso de entrega.
 *
 * Espelha `buildDevolucaoNFeXML` no gerador legado: mesma estrutura da venda,
 * com `tpNF=0` (entrada) e `finNFe=4` (devolução).
 *
 * @module builders/devolucao.builder
 */

import {
  buildFulfillmentInfCplText,
  type FulfillmentInfCplOperation,
} from "@msimulation-xml/fiscal-core";
import type { XmlObject } from "../core/xml-serializer.js";
import type { IdeBuildOptions, NFeBuilderInput } from "./builder.types.js";
import { buildInfAdicNode } from "./nodes/auxiliary.node.js";
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

  protected buildInfAdic(): XmlObject | null {
    return buildInfAdicNode({
      nfe: this.ctx.nfe,
      emitter: this.ctx.emitter,
      extraInfCpl: this.resolveDevolucaoInfCpl(),
    });
  }

  protected resolveInfCplOperation(): FulfillmentInfCplOperation {
    return this.ctx.nfe.tipo === "INSULCESSO_DE_ENTREGA"
      ? "INSULCESSO_DE_ENTREGA"
      : "DEVOLUCAO";
  }

  private resolveDevolucaoInfCpl(): string {
    const fiscal = this.ctx.fiscal;
    const rawOrigem = fiscal.nfeOrigem as Record<string, unknown> | undefined;
    const numero = rawOrigem != null ? Number(rawOrigem.numero) : Number.NaN;
    const serie = rawOrigem != null ? Number(rawOrigem.serie) : Number.NaN;
    if (
      rawOrigem == null ||
      !Number.isFinite(numero) ||
      !Number.isFinite(serie) ||
      numero <= 0 ||
      serie < 0 ||
      rawOrigem.emitidaEm == null ||
      String(rawOrigem.emitidaEm).trim() === ""
    ) {
      throw new Error(
        "DEVOLUCAO/INSULCESSO exige fiscalPayload.nfeOrigem com numero, serie e emitidaEm.",
      );
    }
    const nfeOrigem = {
      numero,
      serie,
      emitidaEm: String(rawOrigem.emitidaEm),
    };

    const ufFilial =
      typeof fiscal.ufFilialInfCpl === "string" ? fiscal.ufFilialInfCpl.trim() : "";
    const cnpjFilial =
      typeof fiscal.cnpjFilialInfCpl === "string" ? fiscal.cnpjFilialInfCpl.trim() : "";

    return buildFulfillmentInfCplText({
      operation: this.resolveInfCplOperation(),
      // Sem filial explícita: omitir regime (não usar dest consumidor).
      ufDestino: ufFilial,
      cnpjFilial,
      nfeOrigem,
    });
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
