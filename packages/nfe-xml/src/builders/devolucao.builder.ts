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
  resolveVendaIdeFields,
  type FulfillmentInfCplOperation,
} from "@msimulation-xml/fiscal-core";
import type { XmlNodeValue, XmlObject } from "../core/xml-serializer.js";
import type { DetBuildResult, IdeBuildOptions, NFeBuilderInput } from "./builder.types.js";
import { buildInfAdicNode } from "./nodes/auxiliary.node.js";
import { devolucaoIdeOptions, normalizeNfeReferenciaChaves } from "./nodes/ide.node.js";
import { VendaNFeStrategyBuilder } from "./venda.builder.js";

/**
 * Estratégia concreta para NF-e de devolução referenciando venda autorizada.
 */
export class DevolucaoNFeStrategyBuilder extends VendaNFeStrategyBuilder {
  protected getIdeOptions(): IdeBuildOptions {
    const d = this.ctx.nfe.destinatario;
    const fiscal = this.ctx.fiscal;
    // cUF/cMunFG seguem saída física do fulfillment (mesmo da venda).
    const ideFields = resolveVendaIdeFields({
      emitUf: this.ctx.emit.endereco.uf,
      emitCMun: this.ctx.emit.endereco.cMun,
      ufSaidaFisica:
        typeof fiscal.ufSaidaFisica === "string" ? fiscal.ufSaidaFisica : undefined,
      cMunSaidaFisica:
        typeof fiscal.cMunSaidaFisica === "string" ? fiscal.cMunSaidaFisica : undefined,
    });

    return {
      ...devolucaoIdeOptions(this.vendaCtx.stockUf, d.endereco.uf),
      idDest: this.vendaCtx.idDest,
      cUfIde: ideFields.cUf,
      cMunFGIde: ideFields.cMunFG,
    };
  }

  protected buildDet(): DetBuildResult {
    const built = super.buildDet();
    const nodes = Array.isArray(built) ? built : [built];
    const chaveAcesso = normalizeNfeReferenciaChaves(this.ctx.nfe.nfeReferenciaChave)[0];
    const nItensOrigem = readNItemOrigem(this.ctx.fiscal.devolucaoItens);

    return nodes.map((node, index) => {
      const nItem = nItensOrigem[index];
      const det = node.det;
      if (!chaveAcesso || nItem == null || !isXmlObject(det)) return node;

      return {
        ...node,
        det: {
          ...det,
          DFeReferenciado: {
            chaveAcesso,
            nItem: String(nItem),
          },
        },
      };
    });
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

function readNItemOrigem(raw: unknown): Array<number | undefined> {
  if (!Array.isArray(raw)) return [];

  return raw.map((entry) => {
    if (entry == null || typeof entry !== "object") return undefined;
    const nItemOrigem = (entry as { nItemOrigem?: unknown }).nItemOrigem;
    const n = typeof nItemOrigem === "number" ? nItemOrigem : Number(nItemOrigem);
    if (!Number.isInteger(n) || n <= 0) return undefined;

    return n;
  });
}

function isXmlObject(value: XmlNodeValue): value is XmlObject {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/** Atalho funcional — retorna AST `nfeProc` de devolução. */
export function buildDevolucaoNFeProcDocument(input: NFeBuilderInput) {
  return new DevolucaoNFeStrategyBuilder(input).build();
}

/** Atalho funcional — retorna XML de devolução via Strategy builder. */
export function buildDevolucaoNFeXml(input: NFeBuilderInput): string {
  return new DevolucaoNFeStrategyBuilder(input).buildXml();
}
