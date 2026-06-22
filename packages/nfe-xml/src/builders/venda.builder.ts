/**
 * Builder Strategy para NF-e de Venda (`tipo === "VENDA"`).
 *
 * Espelha `buildVendaNFeXML` em `nfe-xml-generator.ts`, retornando objetos AST
 * e usando resolvers fiscais de `src/taxes/`.
 *
 * @module builders/venda.builder
 */

import {
  productUnitPriceForNfe,
  resolveFiscalExitUf,
  resolveSaleCfop,
  resolveVendaIdeFields,
} from "@msimulation-xml/fiscal-core";
import type { XmlObject } from "../core/xml-serializer.js";
import { icmsTotFromEngine, type EngineItem } from "../fiscal-engine-xml.js";
import type { IcmsTotValues } from "../fiscal/fiscal-xml.util.js";
import {
  resolveIbsCbsItemVBc,
  VENDA_IBS_CBS_DEFAULTS,
} from "../fiscal/fiscal-xml.util.js";
import type { ProductXmlInput } from "../types.js";
import { BaseNFeBuilder } from "./base-nfe.builder.js";
import type { DetBuildResult, IdeBuildOptions, NFeBuilderInput } from "./builder.types.js";
import {
  buildInfAdicNode,
  buildVendaInfRespTecNode,
  buildVendaPagNode,
} from "./nodes/auxiliary.node.js";
import {
  asNum,
  formatEanForXml,
  ibsCbsBcInputFromEngineItem,
  ibsCbsBcInputFromSnapshot,
  optionalText,
} from "./nodes/builder.util.js";
import { vendaIdeOptions } from "./nodes/ide.node.js";
import { buildItemImpostoNode } from "./nodes/imposto.node.js";
import { buildTotalNode } from "./nodes/total.node.js";
import { buildTranspFromEmitter } from "./nodes/transp.node.js";

export type VendaStrategyContext = {
  stockUf: string;
  cfop: string;
  idDest: number;
  vTotTrib: number;
  vFrete: number;
  item: {
    qCom: number;
    cProd: string;
    cEAN: string;
    xProd: string;
    ncm: string;
    uCom: string;
    orig: number;
    vUnCom: number;
    vProd: number;
    vFrete: number;
    cest?: string;
    exTipi?: string;
    nfci?: string;
    xPed?: string;
    infAdProd?: string;
  };
  taxes: {
    icmsTot: IcmsTotValues;
    vNF: number;
    includeReforma: boolean;
    vBCIBSCBS: number | null;
    vTotTrib: number;
  };
  infCplVenda?: string;
};

/**
 * Estratégia concreta para emissão de NF-e de venda (consumidor final ML).
 */
export class VendaNFeStrategyBuilder extends BaseNFeBuilder {
  protected readonly vendaCtx: VendaStrategyContext;

  constructor(input: NFeBuilderInput) {
    super(input);
    this.vendaCtx = this.resolveVendaContext();
  }

  private resolveVendaContext(): VendaStrategyContext {
    const { nfe, emit, product } = this.input;
    const fiscal = this.ctx.fiscal;
    const e = emit.endereco;
    const d = nfe.destinatario;
    const de = d.endereco;

    const stockUf = resolveFiscalExitUf(
      e.uf,
      typeof fiscal.ufSaidaFisica === "string" ? fiscal.ufSaidaFisica : undefined,
    );
    const cfop =
      nfe.cfop?.trim() ||
      resolveSaleCfop(stockUf, de.uf, d.indIEDest === 9 ? "non_taxpayer" : "taxpayer");
    const idDest = stockUf.toUpperCase() === de.uf.toUpperCase() ? 1 : 2;
    const vTotTrib = asNum(fiscal.vTotTrib, 0);

    const engineFrete = this.ctx.engine?.itens[0]?.vFrete ?? this.ctx.engine?.totais.vFrete ?? 0;
    const payloadFrete = asNum(fiscal.valorFrete, 0);
    const vFrete =
      engineFrete > 0
        ? engineFrete
        : payloadFrete > 0
          ? payloadFrete
          : this.ctx.emitter.bases.vFrete;

    const qCom = nfe.quantidade ?? 1;
    const vUnCom = productUnitPriceForNfe(product, nfe);
    const vProd = nfe.valor;

    let vUnComOut = vUnCom;
    let vProdOut = vProd;
    let qComOut = qCom;
    let vFreteOut = vFrete;
    let vNFOut = nfe.valor + vFrete;
    let icmsTot: IcmsTotValues;

    const icms = (fiscal.icms as Record<string, unknown> | undefined) ?? {};
    const ipi = (fiscal.ipi as Record<string, unknown> | undefined) ?? {};
    const pis = (fiscal.pis as Record<string, unknown> | undefined) ?? {};
    const cofins = (fiscal.cofins as Record<string, unknown> | undefined) ?? {};
    const ibsCbs = (fiscal.ibsCbs as Record<string, unknown> | undefined) ?? {};
    const orig = product?.origem ?? 0;

    if (this.ctx.engine?.itens[0]) {
      const item = this.ctx.engine.itens[0];
      icmsTot = { ...icmsTotFromEngine(this.ctx.engine.totais, vFrete), vTotTrib };
      vUnComOut = item.valorUnitario;
      vProdOut = item.vProd;
      qComOut = item.quantidade;
      vFreteOut = item.vFrete ?? 0;
      vNFOut = this.ctx.engine.totais.vNF;
    } else {
      const vBcIcms = asNum(icms.vBc, this.ctx.emitter.bases.vBcIcms);
      const vBcPis = asNum(pis.vBc, this.ctx.emitter.bases.vBcPisCofins);
      const vBcIpi = asNum(ipi.vBc, this.ctx.emitter.bases.vBcIpi);
      const valorIcms = asNum(icms.valorIcms, nfe.valorICMS);
      const pIpi = asNum(ipi.aliquota, 0);
      const vIpi = Math.round(vBcIpi * (pIpi / 100) * 100) / 100;
      const pPis = asNum(pis.aliquota, 1.65);
      const vPis = Math.round(vBcPis * (pPis / 100) * 100) / 100;
      const pCofins = asNum(cofins.aliquota, 7.6);
      const vCofins = Math.round(vBcPis * (pCofins / 100) * 100) / 100;
      const vNF = Math.round((nfe.valor + vFrete + vIpi) * 100) / 100;
      vNFOut = vNF;
      const difalFiscal = (fiscal.difal as Record<string, unknown> | undefined) ?? {};
      const interstate = idDest === 2;
      icmsTot = {
        vBC: vBcIcms,
        vICMS: valorIcms,
        vProd: nfe.valor,
        vFrete,
        vIPI: vIpi,
        vPIS: vPis,
        vCOFINS: vCofins,
        vNF,
        vTotTrib,
        vFCPUFDest: interstate ? asNum(difalFiscal.vFCPUFDest, 0) : undefined,
        vICMSUFDest: interstate ? asNum(difalFiscal.vICMSUFDest, this.ctx.emitter.difal.vDifal) : undefined,
        vICMSUFRemet: interstate ? asNum(difalFiscal.vICMSUFRemet, 0) : undefined,
      };
    }

    const vendaIbsCbsBcInput = this.ctx.engine?.itens[0]
      ? ibsCbsBcInputFromEngineItem(this.ctx.engine.itens[0])
      : ibsCbsBcInputFromSnapshot(vProdOut, fiscal, asNum(icms.valorIcms, nfe.valorICMS));
    const hasIbsCbsPayload =
      ibsCbs.st != null || ibsCbs.cst != null || ibsCbs.cClassTrib != null;
    const vendaVBcIbsCbs = hasIbsCbsPayload
      ? resolveIbsCbsItemVBc(ibsCbs, vendaIbsCbsBcInput, VENDA_IBS_CBS_DEFAULTS)
      : null;

    const nfciRaw =
      optionalText(typeof fiscal.nfci === "string" ? fiscal.nfci : undefined) ||
      optionalText(product?.nfci);
    const xPed =
      optionalText(typeof fiscal.xPed === "string" ? fiscal.xPed : undefined) ||
      optionalText(nfe.pedidoML);

    return {
      stockUf,
      cfop,
      idDest,
      vTotTrib,
      vFrete,
      item: {
        qCom: qComOut,
        cProd: product?.sku ?? `SKU-${nfe.numero}`,
        cEAN: formatEanForXml(product?.ean),
        xProd: product?.nome ?? nfe.natOp,
        ncm: product?.ncm ?? nfe.ncm,
        uCom: product?.unidade ?? "UN",
        orig,
        vUnCom: vUnComOut,
        vProd: vProdOut,
        vFrete: vFreteOut,
        cest: product?.cest,
        exTipi: product?.exTipi,
        nfci: nfciRaw,
        xPed,
        infAdProd: optionalText(
          typeof fiscal.infAdProd === "string" ? fiscal.infAdProd : undefined,
        ),
      },
      taxes: {
        icmsTot,
        vNF: vNFOut,
        includeReforma: hasIbsCbsPayload && vendaVBcIbsCbs != null,
        vBCIBSCBS: vendaVBcIbsCbs,
        vTotTrib,
      },
      infCplVenda: optionalText(
        typeof fiscal.infCplVenda === "string" ? fiscal.infCplVenda : undefined,
      ),
    };
  }

  protected getIdeOptions(): IdeBuildOptions {
    const d = this.ctx.nfe.destinatario;
    const fiscal = this.ctx.fiscal;
    const ideFields = resolveVendaIdeFields({
      emitUf: this.ctx.emit.endereco.uf,
      emitCMun: this.ctx.emit.endereco.cMun,
      ufSaidaFisica:
        typeof fiscal.ufSaidaFisica === "string" ? fiscal.ufSaidaFisica : undefined,
      cMunSaidaFisica:
        typeof fiscal.cMunSaidaFisica === "string" ? fiscal.cMunSaidaFisica : undefined,
    });

    return {
      ...vendaIdeOptions(this.vendaCtx.stockUf, d.endereco.uf),
      idDest: this.vendaCtx.idDest,
      cUfIde: ideFields.cUf,
      cMunFGIde: ideFields.cMunFG,
    };
  }

  protected buildDet(): DetBuildResult {
    const { item, taxes } = this.vendaCtx;
    const fiscal = this.ctx.fiscal;
    const icms = (fiscal.icms as Record<string, unknown> | undefined) ?? {};
    const engineItem = this.ctx.engine?.itens[0];
    const ibsCbs = (fiscal.ibsCbs as Record<string, unknown> | undefined) ?? {};

    const impostoNode = buildItemImpostoNode({
      engineItem,
      fiscal,
      emitter: this.ctx.emitter,
      icmsSnapshotFallback: {
        orig: item.orig,
        icms,
        vBcIcms: asNum(icms.vBc, this.ctx.emitter.bases.vBcIcms),
        valorIcms: asNum(icms.valorIcms, this.ctx.nfe.valorICMS),
      },
      ibsCbsMode: "venda",
      ibsCbsVBc: taxes.vBCIBSCBS,
      vTotTrib: taxes.vTotTrib > 0 ? taxes.vTotTrib : undefined,
    });

    const prod: XmlObject = {
      cProd: item.cProd,
      cEAN: item.cEAN,
      xProd: item.xProd,
      NCM: item.ncm,
      CFOP: this.vendaCtx.cfop,
      uCom: item.uCom,
      qCom: item.qCom.toFixed(4),
      vUnCom: item.vUnCom.toFixed(8),
      vProd: item.vProd.toFixed(2),
      cEANTrib: item.cEAN,
      uTrib: item.uCom,
      qTrib: item.qCom.toFixed(4),
      vUnTrib: item.vUnCom.toFixed(8),
      indTot: 1,
    };
    if (item.cest) prod.CEST = item.cest;
    if (item.exTipi) prod.EXTIPI = item.exTipi;
    if (item.vFrete > 0) prod.vFrete = item.vFrete.toFixed(2);
    if (item.xPed) prod.xPed = item.xPed;
    if (item.nfci) prod.nFCI = item.nfci;

    const detNode: XmlObject = {
      "@nItem": "1",
      prod,
      imposto: impostoNode.imposto,
      vItem: item.vProd.toFixed(2),
    };
    if (item.infAdProd) detNode.infAdProd = item.infAdProd;

    return { det: detNode };
  }

  protected buildTransp(): XmlObject {
    return buildTranspFromEmitter(
      this.ctx.emitter,
      this.ctx.fiscal,
      this.vendaCtx.item.qCom,
    );
  }

  protected buildTotal(): XmlObject {
    const ibsCbs = (this.ctx.fiscal.ibsCbs as Record<string, unknown> | undefined) ?? {};
    return buildTotalNode({
      icmsTot: this.vendaCtx.taxes.icmsTot,
      // vNFTot ML usa vProd do item, não vNF com frete (espelha totalBlock legado).
      vNF: this.vendaCtx.item.vProd,
      includeReformaTributaria: this.vendaCtx.taxes.includeReforma,
      vBCIBSCBS: this.vendaCtx.taxes.vBCIBSCBS,
      ibsCbs,
    });
  }

  protected buildPag(): XmlObject {
    return buildVendaPagNode(this.vendaCtx.taxes.vNF, this.ctx.fiscal);
  }

  protected buildInfAdic(): XmlObject | null {
    return buildInfAdicNode({
      nfe: this.ctx.nfe,
      emitter: this.ctx.emitter,
      extraInfCpl: this.vendaCtx.infCplVenda,
    });
  }

  protected buildInfRespTec(): XmlObject {
    return buildVendaInfRespTecNode();
  }

  protected shouldIncludeInfIntermed(): boolean {
    return true;
  }

  protected shouldIncludeDestIe(): boolean {
    return true;
  }
}

/** Atalho funcional — retorna AST `nfeProc` de venda. */
export function buildVendaNFeProcDocument(input: NFeBuilderInput) {
  return new VendaNFeStrategyBuilder(input).build();
}

/** Atalho funcional — retorna XML de venda via Strategy builder. */
export function buildVendaNFeXml(input: NFeBuilderInput): string {
  return new VendaNFeStrategyBuilder(input).buildXml();
}

export type { EngineItem };
