/**
 * Node builders para bloco `<total>` (ICMSTot, IBSCBSTot, vNFTot).
 *
 * @module builders/nodes/total.node
 */

import type { XmlObject } from "../../core/xml-serializer.js";
import {
  calcIbsCbsVendaValues,
  type IcmsTotValues,
} from "../../fiscal/fiscal-xml.util.js";
import { formatMoney2, asNumeric } from "../../taxes/tax-format.util.js";

/** Monta nó `<ICMSTot>`. */
export function buildIcmsTotNode(t: IcmsTotValues): XmlObject {
  const hasDifalValues =
    (t.vFCPUFDest ?? 0) !== 0 || (t.vICMSUFDest ?? 0) !== 0 || (t.vICMSUFRemet ?? 0) !== 0;

  const icmsTot: XmlObject = {
    vBC: formatMoney2(t.vBC),
    vICMS: formatMoney2(t.vICMS),
    vICMSDeson: "0.00",
    vFCP: "0.00",
    vBCST: "0.00",
    vST: "0.00",
    vFCPST: "0.00",
    vFCPSTRet: "0.00",
    vProd: formatMoney2(t.vProd),
    vFrete: formatMoney2(t.vFrete),
    vSeg: "0.00",
    vDesc: "0.00",
    vII: "0.00",
    vIPI: formatMoney2(t.vIPI),
    vIPIDevol: "0.00",
    vPIS: formatMoney2(t.vPIS),
    vCOFINS: formatMoney2(t.vCOFINS),
    vOutro: "0.00",
    vNF: formatMoney2(t.vNF),
    vTotTrib: formatMoney2(t.vTotTrib ?? 0),
  };

  if (hasDifalValues) {
    icmsTot.vFCPUFDest = formatMoney2(t.vFCPUFDest ?? 0);
    icmsTot.vICMSUFDest = formatMoney2(t.vICMSUFDest ?? 0);
    icmsTot.vICMSUFRemet = formatMoney2(t.vICMSUFRemet ?? 0);
  }

  return { ICMSTot: icmsTot };
}

export type TotalNodeOptions = {
  icmsTot: IcmsTotValues;
  vNF: number;
  includeReformaTributaria?: boolean;
  vBCIBSCBS?: number | null;
  ibsCbs?: Record<string, unknown> | null;
};

/** Monta bloco `<total>` completo. */
export function buildTotalNode(opts: TotalNodeOptions): XmlObject {
  const totalChildren: XmlObject[] = [buildIcmsTotNode(opts.icmsTot)];

  if (opts.includeReformaTributaria && opts.vBCIBSCBS != null) {
    totalChildren.push(...buildReformaTributariaTotNodes(opts.vBCIBSCBS, opts.vNF, opts.ibsCbs));
  } else if (opts.includeReformaTributaria) {
    totalChildren.push({
      IBSCBSTot: { vBCIBSCBS: formatMoney2(opts.vBCIBSCBS ?? 0) },
    });
    totalChildren.push({ vNFTot: formatMoney2(opts.vNF) });
  }

  const total: XmlObject = {};
  for (const child of totalChildren) {
    Object.assign(total, child);
  }

  return { total };
}

/** Monta `<IBSCBSTot>` e `<vNFTot>` para venda com reforma tributária. */
export function buildReformaTributariaTotNodes(
  vBCIBSCBS: number,
  vNF: number,
  ibsCbs?: Record<string, unknown> | null,
): XmlObject[] {
  const rates = {
    pIBSUF: asNumeric(ibsCbs?.pIBSUF, 0.1),
    pIBSMun: asNumeric(ibsCbs?.pIBSMun, 0),
    pCBS: asNumeric(ibsCbs?.pCBS, 0.9),
  };
  const { vIBSUF, vIBSMun, vIBS, vCBS } = calcIbsCbsVendaValues(vBCIBSCBS, rates);

  return [
    {
      IBSCBSTot: {
        vBCIBSCBS: formatMoney2(vBCIBSCBS),
        gIBS: {
          gIBSUF: { vDif: "0.00", vDevTrib: "0.00", vIBSUF: formatMoney2(vIBSUF) },
          gIBSMun: { vDif: "0.00", vDevTrib: "0.00", vIBSMun: formatMoney2(vIBSMun) },
          vIBS: formatMoney2(vIBS),
          vCredPres: "0.00",
          vCredPresCondSus: "0.00",
        },
        gCBS: {
          vDif: "0.00",
          vDevTrib: "0.00",
          vCBS: formatMoney2(vCBS),
          vCredPres: "0.00",
          vCredPresCondSus: "0.00",
        },
      },
    },
    { vNFTot: formatMoney2(vNF) },
  ];
}

/** Monta `<total>` simplificado para remessa (IBSCBSTot sem grupos gIBS/gCBS). */
export function buildRemessaTotalNode(
  icmsTot: IcmsTotValues,
  vNF: number,
  vBCIBSCBS: number,
): XmlObject {
  const total: XmlObject = {};
  Object.assign(total, buildIcmsTotNode(icmsTot));
  Object.assign(total, {
    IBSCBSTot: { vBCIBSCBS: formatMoney2(vBCIBSCBS) },
  });
  Object.assign(total, { vNFTot: formatMoney2(vNF) });
  return { total };
}
