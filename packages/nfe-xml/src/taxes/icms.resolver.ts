/**
 * Resolver puro de ICMS — retorna objetos AST, nunca strings XML.
 *
 * Espelha:
 * - `buildIcmsXmlFromSnapshot` em `nfe-xml-generator.ts` (snapshot fiscal / remessa)
 * - `buildIcmsXmlFromEngineItem` em `fiscal-engine-xml.ts` (item da engine)
 *
 * @module taxes/icms.resolver
 */

import type { NfeIcmsImposto } from "../core/nfe-ast.types.js";
import type { EngineIcms } from "../fiscal-engine-xml.js";
import { roundMoney, asNumeric, formatMoney2, formatMoney4, cst2Digits } from "./tax-format.util.js";

/** Entrada de contexto para cálculo ICMS a partir de snapshot fiscal. */
export type IcmsSnapshotContext = {
  orig: number;
  valor: number;
  valorIcms: number;
};

/**
 * Resolve `<ICMS>` a partir de snapshot da regra fiscal (sem engine).
 * Replica o switch CST/CSOSN de `buildIcmsXmlFromSnapshot`.
 */
export function resolveIcmsFromSnapshot(
  icms: Record<string, unknown>,
  context: IcmsSnapshotContext,
): NfeIcmsImposto {
  const cst = cst2Digits(String(icms.cst ?? "00"));
  const pIcms = asNumeric(icms.aliquota, 0);
  const pRedBc = asNumeric(icms.pRedBc, 0);
  const pRedBcSt = asNumeric(icms.pRedBcSt, 0);
  const pMva = asNumeric(icms.pMva, 0);
  const pIcmsStRet = asNumeric(icms.pIcmsStRet, 0);
  const pFcpStRet = asNumeric(icms.pFcpStRet, 0);
  const pIcmsEfet = asNumeric(icms.pIcmsEfet, 0);
  const pRedBcEfet = asNumeric(icms.pRedBcEfet, 0);
  const motDesIcms = Math.trunc(asNumeric(icms.motDesIcms, 0));

  const vBcFromSnapshot = icms.vBc != null ? asNumeric(icms.vBc, context.valor) : null;
  const vBc =
    vBcFromSnapshot ?? (pIcms === 0 ? 0 : Math.max(0, context.valor * (1 - pRedBc / 100)));
  const vIcms =
    asNumeric(icms.valorIcms, 0) ||
    context.valorIcms ||
    roundMoney(vBc * (pIcms / 100));
  const vBcSt = Math.max(0, vBc * (1 + pMva / 100) * (1 - pRedBcSt / 100));
  const vIcmsSt = Math.max(0, roundMoney(vBcSt * (pIcmsStRet / 100)));
  const vBcEfet = Math.max(0, context.valor * (1 - pRedBcEfet / 100));
  const vIcmsEfet = Math.max(0, roundMoney(vBcEfet * (pIcmsEfet / 100)));
  const vFcpSt = Math.max(0, roundMoney(vBcSt * (pFcpStRet / 100)));

  const cBenef =
    typeof icms.codBenef === "string" && icms.codBenef.trim()
      ? { cBenef: String(icms.codBenef) }
      : {};
  const motDes = motDesIcms > 0 ? { motDesICMS: motDesIcms } : {};

  switch (cst) {
    case "10":
      return {
        ICMS: {
          ICMS10: {
            orig: context.orig,
            CST: "10",
            modBC: 3,
            vBC: formatMoney2(vBc),
            pICMS: formatMoney4(pIcms),
            vICMS: formatMoney2(vIcms),
            modBCST: 4,
            pMVAST: formatMoney4(pMva),
            pRedBCST: formatMoney4(pRedBcSt),
            vBCST: formatMoney2(vBcSt),
            pICMSST: formatMoney4(pIcmsStRet),
            vICMSST: formatMoney2(vIcmsSt),
          },
        },
      };
    case "20":
      return {
        ICMS: {
          ICMS20: {
            orig: context.orig,
            CST: "20",
            modBC: 3,
            pRedBC: formatMoney4(pRedBc),
            vBC: formatMoney2(vBc),
            pICMS: formatMoney4(pIcms),
            vICMS: formatMoney2(vIcms),
            ...motDes,
            ...cBenef,
          },
        },
      };
    case "30":
      return {
        ICMS: {
          ICMS30: {
            orig: context.orig,
            CST: "30",
            modBCST: 4,
            pMVAST: formatMoney4(pMva),
            pRedBCST: formatMoney4(pRedBcSt),
            vBCST: formatMoney2(vBcSt),
            pICMSST: formatMoney4(pIcmsStRet),
            vICMSST: formatMoney2(vIcmsSt),
            vBCFCPST: formatMoney2(vBcSt),
            pFCPST: formatMoney4(pFcpStRet),
            vFCPST: formatMoney2(vFcpSt),
            ...motDes,
            ...cBenef,
          },
        },
      };
    case "40":
    case "50":
      return {
        ICMS: { ICMS40: { orig: context.orig, CST: cst, ...motDes, ...cBenef } },
      };
    case "41":
      return {
        ICMS: { ICMS40: { orig: context.orig, CST: "41", ...motDes, ...cBenef } },
      };
    case "51":
      return {
        ICMS: {
          ICMS51: {
            orig: context.orig,
            CST: "51",
            modBC: 3,
            pRedBC: formatMoney4(pRedBc),
            pICMS: formatMoney4(pIcms),
          },
        },
      };
    case "60":
      return {
        ICMS: {
          ICMS60: {
            orig: context.orig,
            CST: "60",
            vBCSTRet: formatMoney2(vBcSt),
            pST: formatMoney4(pIcmsStRet),
            vICMSSubstituto: formatMoney2(vIcmsSt),
            vICMSSTRet: formatMoney2(vIcmsSt),
            vBCFCPSTRet: formatMoney2(vBcSt),
            pFCPSTRet: formatMoney4(pFcpStRet),
            vFCPSTRet: formatMoney2(vFcpSt),
          },
        },
      };
    case "70":
      return {
        ICMS: {
          ICMS70: {
            orig: context.orig,
            CST: "70",
            modBC: 3,
            pRedBC: formatMoney4(pRedBc),
            vBC: formatMoney2(vBc),
            pICMS: formatMoney4(pIcms),
            vICMS: formatMoney2(vIcms),
            modBCST: 4,
            pMVAST: formatMoney4(pMva),
            pRedBCST: formatMoney4(pRedBcSt),
            vBCST: formatMoney2(vBcSt),
            pICMSST: formatMoney4(pIcmsStRet),
            vICMSST: formatMoney2(vIcmsSt),
            vICMSDeson: formatMoney2(vIcmsEfet),
            ...motDes,
            ...cBenef,
          },
        },
      };
    case "90":
      return {
        ICMS: {
          ICMS90: {
            orig: context.orig,
            CST: "90",
            modBC: 3,
            vBC: formatMoney2(vBc),
            pRedBC: formatMoney4(pRedBc),
            pICMS: formatMoney4(pIcms),
            vICMS: formatMoney2(vIcms),
            modBCST: 4,
            pMVAST: formatMoney4(pMva),
            pRedBCST: formatMoney4(pRedBcSt),
            vBCST: formatMoney2(vBcSt),
            pICMSST: formatMoney4(pIcmsStRet),
            vICMSST: formatMoney2(vIcmsSt),
          },
        },
      };
    default:
      return {
        ICMS: {
          ICMS00: {
            orig: context.orig,
            CST: "00",
            modBC: 3,
            vBC: formatMoney2(context.valor),
            pICMS: formatMoney4(pIcms),
            vICMS: formatMoney2(context.valorIcms),
          },
        },
      };
  }
}

/**
 * Resolve `<ICMS>` a partir do item da engine fiscal.
 * Replica `buildIcmsXmlFromEngineItem` — inclui FCP opcional e grupos simplificados (40/41/50/60/90).
 */
export function resolveIcmsFromEngine(icms: EngineIcms): NfeIcmsImposto {
  const cst = cst2Digits(icms.cst);
  const modBC = icms.modBC ?? 3;
  const fcpFields =
    (icms.pFCP ?? 0) > 0
      ? { pFCP: formatMoney4(icms.pFCP!), vFCP: formatMoney2(icms.vFCP ?? 0) }
      : {};

  if (["40", "41", "50"].includes(cst)) {
    return { ICMS: { ICMS40: { orig: icms.orig, CST: cst } } };
  }

  if (cst === "60") {
    return { ICMS: { ICMS60: { orig: icms.orig, CST: "60" } } };
  }

  if (cst === "90" && icms.vBC === 0 && icms.vICMS === 0) {
    return { ICMS: { ICMS90: { orig: icms.orig, CST: "90" } } };
  }

  const groupName = cst === "00" ? "ICMS00" : `ICMS${cst}`;
  return {
    ICMS: {
      [groupName]: {
        orig: icms.orig,
        CST: cst,
        modBC,
        vBC: formatMoney2(icms.vBC),
        pICMS: formatMoney4(icms.pICMS),
        vICMS: formatMoney2(icms.vICMS),
        ...fcpFields,
      },
    },
  };
}
