/**
 * Espelhamento proporcional da NF-e de origem para devolução (finNFe=4).
 *
 * Regras (NT / MOC / EC 87):
 * - Bases e impostos espelham a saída (proporção qty devolvida / qty origem).
 * - DIFAL: mantém vICMSUFDest / vICMSUFRemet da origem (não inverte).
 * - FCP em DIFAL: só vFCPUFDest; vFCP = 0.
 * - IPI de não contribuinte: sai do IPI tributado e vai para impostoDevol
 *   (pDevol + vIPIDevol); vIPI nos totais = 0; vNF inclui vIPIDevol.
 */

import {
  calcularTotais,
  round2,
  type ItemFiscalResult,
  type NotaFiscalResult,
  type NotaFiscalTotais,
} from "./tax-engine.js";

export type ImpostoDevolItem = {
  pDevol: number;
  vIPIDevol: number;
};

export type MirrorOriginForDevolucaoInput = {
  /** Engine persistida na venda (`fiscalPayload.engine`). */
  origin: NotaFiscalResult;
  /** Quantidade devolvida / quantidade da venda (1 = devolução integral). */
  ratio: number;
  /**
   * Cliente não contribuinte de IPI (tipicamente indIEDest=9 / PF).
   * Quando true e houver IPI na origem → impostoDevol (NT 2016.002).
   */
  nonContributorIpi: boolean;
};

function scale(value: number, ratio: number): number {
  return round2(value * ratio);
}

function scaleDifal(
  difal: NonNullable<ItemFiscalResult["difal"]>,
  ratio: number,
): NonNullable<ItemFiscalResult["difal"]> {
  return {
    vBCUFDest: scale(difal.vBCUFDest, ratio),
    pICMSUFDest: difal.pICMSUFDest,
    pICMSInter: difal.pICMSInter,
    pICMSInterPart: difal.pICMSInterPart,
    // Espelha destino/origem da saída — NÃO inverter na devolução.
    vICMSUFDest: scale(difal.vICMSUFDest, ratio),
    vICMSUFRemet: scale(difal.vICMSUFRemet, ratio),
    vBCFCPUFDest: scale(difal.vBCFCPUFDest, ratio),
    pFCPUFDest: difal.pFCPUFDest,
    vFCPUFDest: scale(difal.vFCPUFDest, ratio),
  };
}

function scaleItem(item: ItemFiscalResult, ratio: number): ItemFiscalResult {
  const hasDifal = item.difal != null;
  const scaled: ItemFiscalResult = {
    ...item,
    quantidade: round2(item.quantidade * ratio),
    vProd: scale(item.vProd, ratio),
    vFrete: scale(item.vFrete, ratio),
    vSeg: scale(item.vSeg, ratio),
    vDesc: scale(item.vDesc, ratio),
    vOutro: scale(item.vOutro, ratio),
    icms: {
      ...item.icms,
      vBC: scale(item.icms.vBC, ratio),
      vICMS: scale(item.icms.vICMS, ratio),
      // EC 87: FCP próprio zerado quando há DIFAL.
      pFCP: hasDifal ? 0 : item.icms.pFCP,
      vFCP: hasDifal ? 0 : scale(item.icms.vFCP, ratio),
      vBCST: item.icms.vBCST != null ? scale(item.icms.vBCST, ratio) : undefined,
      vICMSST: item.icms.vICMSST != null ? scale(item.icms.vICMSST, ratio) : undefined,
      vFCPST: item.icms.vFCPST != null ? scale(item.icms.vFCPST, ratio) : undefined,
    },
    pis: {
      ...item.pis,
      vBC: scale(item.pis.vBC, ratio),
      vPIS: scale(item.pis.vPIS, ratio),
    },
    cofins: {
      ...item.cofins,
      vBC: scale(item.cofins.vBC, ratio),
      vCOFINS: scale(item.cofins.vCOFINS, ratio),
    },
    difal: item.difal ? scaleDifal(item.difal, ratio) : undefined,
    ipi: item.ipi
      ? {
          ...item.ipi,
          vBC: scale(item.ipi.vBC, ratio),
          vIPI: scale(item.ipi.vIPI, ratio),
        }
      : undefined,
  };
  return scaled;
}

/**
 * Espelha a engine da venda para a devolução.
 * Preferir este caminho ao recalcular TaxRule do zero.
 */
export function mirrorOriginForDevolucao(
  input: MirrorOriginForDevolucaoInput,
): NotaFiscalResult {
  const ratio =
    typeof input.ratio === "number" && Number.isFinite(input.ratio) && input.ratio > 0
      ? input.ratio
      : 1;

  const itens: ItemFiscalResult[] = [];

  for (const originItem of input.origin.itens) {
    let item = scaleItem(originItem, ratio);
    const vIpi = item.ipi?.vIPI ?? 0;

    if (input.nonContributorIpi && vIpi > 0) {
      item = {
        ...item,
        impostoDevol: { pDevol: 100, vIPIDevol: vIpi },
        // IPI não entra em vProd/vOutro/vIPI — só impostoDevol (NT 2016.002).
        ipi: undefined,
      };
    }

    itens.push(item);
  }

  return { itens, totais: calcularTotais(itens) };
}

/** Extrai engine da venda a partir do JSON persistido (fiscalPayload.engine). */
export function parseOriginEngine(raw: unknown): NotaFiscalResult | null {
  if (!raw || typeof raw !== "object") return null;
  const eng = raw as Record<string, unknown>;
  const itensRaw = eng.itens;
  const totaisRaw = eng.totais;
  if (!Array.isArray(itensRaw) || !totaisRaw || typeof totaisRaw !== "object") return null;
  if (itensRaw.length === 0) return null;

  try {
    const totais = totaisRaw as NotaFiscalTotais;
    return {
      itens: itensRaw as ItemFiscalResult[],
      totais: {
        ...totais,
        vIPIDevol: totais.vIPIDevol ?? 0,
      },
    };
  } catch {
    return null;
  }
}
