/**
 * Builder Strategy para NF-e de Remessa (`REMESSA`, `REMESSA_SIMBOLICA`, `REMESSA_AVANCO`, `TRANSFERENCIA_FILIAL`).
 *
 * Espelha `buildRemessaNFeXML` em `nfe-xml-generator.ts`, retornando objetos AST
 * e usando resolvers fiscais de `src/taxes/`.
 *
 * @module builders/remessa.builder
 */

import { productUnitPriceForNfe } from "@msimulation-xml/fiscal-core";
import type { XmlObject } from "../core/xml-serializer.js";
import { icmsTotFromEngine } from "../fiscal-engine-xml.js";
import type { IcmsTotValues } from "../fiscal/fiscal-xml.util.js";
import {
  REMESSA_IBS_CBS_DEFAULTS,
  remessaInfCplText,
  remessaSimbolicaPosDevolucaoInfCplText,
  resolveIbsCbsItemVBc,
  sumIbsCbsVBc,
} from "../fiscal/fiscal-xml.util.js";
import type { NFeItemXmlInput, ProductXmlInput } from "../types.js";
import { BaseNFeBuilder } from "./base-nfe.builder.js";
import type { DetBuildResult, IdeBuildOptions, NFeBuilderInput } from "./builder.types.js";
import {
  buildInfAdicNode,
  buildRemessaInfRespTecNode,
  buildRemessaPagNode,
} from "./nodes/auxiliary.node.js";
import {
  asNum,
  formatEanForXml,
  formatNfeQuantity,
  hasMlFulfillmentPayload,
  ibsCbsBcInputFromEngineItem,
  ibsCbsBcInputFromSnapshot,
  optionalText,
} from "./nodes/builder.util.js";
import { remessaIdeOptions } from "./nodes/ide.node.js";
import { buildItemImpostoNode } from "./nodes/imposto.node.js";
import { buildRemessaTotalNode } from "./nodes/total.node.js";
import { buildTranspFromEmitter } from "./nodes/transp.node.js";

type RemessaItemContext = {
  index: number;
  qCom: number;
  cProd: string;
  cEAN: string;
  xProd: string;
  ncm: string;
  cfop: string;
  uCom: string;
  vUnCom: number;
  vProd: number;
  orig: number;
  cest?: string;
  exTipi?: string;
  nfci?: string;
  infAdProd?: string;
  vBcIcms: number;
  valorIcms: number;
  ibsCbsVBc: number | null;
  product?: ProductXmlInput;
};

type RemessaStrategyContext = {
  icmsTot: IcmsTotValues;
  vNF: number;
  vBCIBSCBS: number;
  totalQty: number;
  items: RemessaItemContext[];
  destIe: string;
};

/**
 * Estratégia concreta para emissão de NF-e de remessa (fulfillment ML).
 */
export class RemessaNFeStrategyBuilder extends BaseNFeBuilder {
  private readonly remessaCtx: RemessaStrategyContext;

  constructor(input: NFeBuilderInput) {
    super(input);
    this.remessaCtx = this.resolveRemessaContext();
  }

  private resolveItemCount(): number {
    const { nfe, product, products } = this.input;
    return Math.max(
      this.ctx.engine?.itens.length ?? 0,
      nfe.itens?.length ?? 0,
      products?.length ?? 0,
      1,
    );
  }

  private resolveProductAt(index: number): ProductXmlInput | undefined {
    const { nfe, product, products } = this.input;
    const dtoItem = nfe.itens?.[index];
    return products?.[index] ?? dtoItem?.product ?? (index === 0 ? product : undefined);
  }

  private resolveRemessaContext(): RemessaStrategyContext {
    const { nfe } = this.input;
    const fiscal = this.ctx.fiscal;
    const icms = (fiscal.icms as Record<string, unknown> | undefined) ?? {
      cst: "00",
      aliquota: nfe.aliqICMS,
    };
    const ibsCbs = (fiscal.ibsCbs as Record<string, unknown> | undefined) ?? {};
    const vFrete = this.ctx.emitter.freteNoCalculo ? this.ctx.emitter.bases.vFrete : 0;

    const itemCount = this.resolveItemCount();
    const totalQty =
      this.ctx.engine?.itens.reduce((s, it) => s + it.quantidade, 0) ??
      nfe.itens?.reduce((s, it) => s + it.quantidade, 0) ??
      nfe.quantidade;

    let icmsTot: IcmsTotValues;
    let vNFTotal: number;

    if (this.ctx.engine?.itens.length) {
      icmsTot = icmsTotFromEngine(this.ctx.engine.totais, vFrete);
      vNFTotal = this.ctx.engine.totais.vNF;
    } else {
      const vBcIcms = asNum(icms.vBc, this.ctx.emitter.bases.vBcIcms);
      const valorIcms = asNum(icms.valorIcms, nfe.valorICMS);
      vNFTotal = nfe.valor;
      icmsTot = {
        vBC: vBcIcms,
        vICMS: valorIcms,
        vProd: nfe.valor,
        vFrete,
        vIPI: 0,
        vPIS: 0,
        vCOFINS: 0,
        vNF: vNFTotal,
      };
    }

    const ibsCbsVBcValues: number[] = [];
    const items: RemessaItemContext[] = [];

    for (let i = 0; i < itemCount; i++) {
      const dtoItem: NFeItemXmlInput | undefined = nfe.itens?.[i];
      const prod = this.resolveProductAt(i);
      const engineItem = this.ctx.engine?.itens[i];
      const qCom =
        dtoItem?.quantidade ??
        engineItem?.quantidade ??
        (itemCount === 1 ? nfe.quantidade : 1);
      const cProd = prod?.sku ?? dtoItem?.product?.sku ?? `SKU-${nfe.numero}-${i + 1}`;
      const cEAN = formatEanForXml(prod?.ean ?? dtoItem?.product?.ean);
      const xProd = prod?.nome ?? dtoItem?.product?.nome ?? nfe.natOp;
      const ncm = dtoItem?.ncm ?? prod?.ncm ?? dtoItem?.product?.ncm ?? nfe.ncm;
      const cfop = dtoItem?.cfop ?? nfe.cfop;
      const uCom = prod?.unidade ?? dtoItem?.product?.unidade ?? "UNID";
      const vUnComOut =
        engineItem?.valorUnitario ??
        (dtoItem?.valor != null && qCom
          ? dtoItem.valor / qCom
          : productUnitPriceForNfe(prod, nfe));
      const vProdOut = engineItem?.vProd ?? dtoItem?.valor ?? nfe.valor;
      const orig = prod?.origem ?? dtoItem?.product?.origem ?? 1;
      const exTipi =
        prod?.exTipi ??
        dtoItem?.product?.exTipi ??
        (i === 0 && typeof fiscal.exTipi === "string" ? fiscal.exTipi : undefined);
      const nfciRaw =
        optionalText(typeof fiscal.nfci === "string" ? fiscal.nfci : undefined) ||
        optionalText(prod?.nfci);
      const infAdProd =
        i === 0 && nfe.pedidoML ? `xPed:${nfe.pedidoML}` : undefined;

      const vBcIcmsItem = asNum(icms.vBc, this.ctx.emitter.bases.vBcIcms);
      const valorIcmsItem = asNum(icms.valorIcms, nfe.valorICMS);
      const ibsCbsBcInput = engineItem
        ? ibsCbsBcInputFromEngineItem(engineItem)
        : ibsCbsBcInputFromSnapshot(vProdOut, fiscal, valorIcmsItem);
      const itemVBcIbsCbs = resolveIbsCbsItemVBc(
        ibsCbs,
        ibsCbsBcInput,
        REMESSA_IBS_CBS_DEFAULTS,
      );
      if (itemVBcIbsCbs != null) ibsCbsVBcValues.push(itemVBcIbsCbs);

      items.push({
        index: i,
        qCom,
        cProd,
        cEAN,
        xProd,
        ncm,
        cfop,
        uCom,
        vUnCom: vUnComOut,
        vProd: vProdOut,
        orig,
        cest: prod?.cest ?? dtoItem?.product?.cest,
        exTipi,
        nfci: nfciRaw,
        infAdProd,
        vBcIcms: vBcIcmsItem,
        valorIcms: valorIcmsItem,
        ibsCbsVBc: itemVBcIbsCbs,
        product: prod,
      });
    }

    const destIe =
      (typeof fiscal.destIe === "string" && fiscal.destIe) ||
      (typeof nfe.destinatario.ie === "string" && nfe.destinatario.ie) ||
      "";

    return {
      icmsTot,
      vNF: vNFTotal,
      vBCIBSCBS: sumIbsCbsVBc(ibsCbsVBcValues),
      totalQty,
      items,
      destIe,
    };
  }

  protected getIdeOptions(): IdeBuildOptions {
    const e = this.ctx.emit.endereco;
    const d = this.ctx.nfe.destinatario;
    return remessaIdeOptions(e.uf, d.endereco.uf, this.ctx.nfe.tipo);
  }

  protected buildDet(): DetBuildResult {
    const fiscal = this.ctx.fiscal;
    const icms = (fiscal.icms as Record<string, unknown> | undefined) ?? {};

    return this.remessaCtx.items.map((item) => {
      const engineItem = this.ctx.engine?.itens[item.index];
      const impostoNode = buildItemImpostoNode({
        engineItem,
        fiscal,
        emitter: this.ctx.emitter,
        icmsSnapshotFallback: {
          orig: item.orig,
          icms,
          vBcIcms: item.vBcIcms,
          valorIcms: item.valorIcms,
        },
        ibsCbsMode: "remessa",
        ibsCbsVBc: item.ibsCbsVBc,
      });

      const prod: XmlObject = {
        cProd: item.cProd,
        cEAN: item.cEAN,
        xProd: item.xProd,
        NCM: item.ncm,
        CFOP: item.cfop,
        uCom: item.uCom,
        qCom: formatNfeQuantity(item.qCom),
        vUnCom: item.vUnCom.toFixed(8),
        vProd: item.vProd.toFixed(2),
        cEANTrib: item.cEAN,
        uTrib: item.uCom,
        qTrib: formatNfeQuantity(item.qCom),
        vUnTrib: item.vUnCom.toFixed(8),
        indTot: 1,
      };
      if (item.cest) prod.CEST = item.cest;
      if (item.exTipi) prod.EXTIPI = item.exTipi;
      if (item.nfci) prod.nFCI = item.nfci;

      const detNode: XmlObject = {
        "@nItem": String(item.index + 1),
        prod,
        imposto: impostoNode.imposto,
        vItem: item.vProd.toFixed(2),
      };
      if (item.infAdProd) detNode.infAdProd = item.infAdProd;

      return { det: detNode };
    });
  }

  protected buildTransp(): XmlObject {
    return buildTranspFromEmitter(
      this.ctx.emitter,
      this.ctx.fiscal,
      this.remessaCtx.totalQty,
    );
  }

  protected buildTotal(): XmlObject {
    return buildRemessaTotalNode(
      this.remessaCtx.icmsTot,
      this.remessaCtx.vNF,
      this.remessaCtx.vBCIBSCBS,
    );
  }

  protected buildPag(): XmlObject {
    return buildRemessaPagNode();
  }

  protected buildInfAdic(): XmlObject | null {
    return buildInfAdicNode({
      nfe: this.ctx.nfe,
      emitter: this.ctx.emitter,
      extraInfCpl: this.resolveRemessaInfCpl(),
    });
  }

  private resolveRemessaInfCpl(): string {
    const fiscal = this.ctx.fiscal;
    const posDevolucao = fiscal.remessaSimbolicaPosDevolucao as
      | Record<string, unknown>
      | undefined;

    if (this.ctx.nfe.tipo === "REMESSA_SIMBOLICA" && posDevolucao) {
      return remessaSimbolicaPosDevolucaoInfCplText({
        destIe: this.remessaCtx.destIe,
        devolucaoNumero: Number(posDevolucao.numero),
        devolucaoSerie: Number(posDevolucao.serie),
        devolucaoEmitidaEm: String(posDevolucao.emitidaEm ?? this.ctx.nfe.emitidaEm),
      });
    }

    return remessaInfCplText(this.remessaCtx.destIe);
  }

  protected buildInfRespTec(): XmlObject | null {
    return hasMlFulfillmentPayload(this.ctx.fiscal)
      ? buildRemessaInfRespTecNode()
      : null;
  }

  protected shouldIncludeInfIntermed(): boolean {
    return true;
  }

  protected shouldIncludeDestIe(): boolean {
    return true;
  }
}

/** Atalho funcional — retorna AST `nfeProc` de remessa. */
export function buildRemessaNFeProcDocument(input: NFeBuilderInput) {
  return new RemessaNFeStrategyBuilder(input).build();
}

/** Atalho funcional — retorna XML de remessa via Strategy builder. */
export function buildRemessaNFeXml(input: NFeBuilderInput): string {
  return new RemessaNFeStrategyBuilder(input).buildXml();
}
