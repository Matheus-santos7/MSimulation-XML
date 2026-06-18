/**
 * Node builders para `<imposto>` por item — usa resolvers de `src/taxes/`.
 *
 * @module builders/nodes/imposto.node
 */

import type { XmlObject } from "../../core/xml-serializer.js";
import type { EngineDifal, EngineItem } from "../../fiscal-engine-xml.js";
import type { resolveEmitterFromPayload } from "../../resolve-emitter.js";
import {
  resolveIcmsFromEngine,
  resolveIcmsFromSnapshot,
} from "../../taxes/icms.resolver.js";
import {
  resolveIbsCbsImpostoRemessa,
  resolveIbsCbsImpostoVenda,
} from "../../taxes/ibscbs.resolver.js";
import { resolveIpiFromEngine, resolveIpiFromSnapshot, resolveIpiInt } from "../../taxes/ipi.resolver.js";
import { resolvePisCofinsFromEngine } from "../../taxes/pis-cofins.resolver.js";
import { formatMoney2, formatMoney4 } from "../../taxes/tax-format.util.js";
import { asNum } from "./builder.util.js";

export type ItemImpostoInput = {
  engineItem?: EngineItem;
  fiscal: Record<string, unknown>;
  emitter: ReturnType<typeof resolveEmitterFromPayload>;
  icmsSnapshotFallback: {
    orig: number;
    icms?: Record<string, unknown>;
    vBcIcms: number;
    valorIcms: number;
  };
  ibsCbsMode: "venda" | "remessa";
  ibsCbsVBc?: number | null;
  vTotTrib?: number;
};

function resolveIcmsUfDestFromEngine(difal: EngineDifal): XmlObject | null {
  if (!Number.isFinite(difal.vBCUFDest) || difal.vBCUFDest <= 0) return null;
  if (!Number.isFinite(difal.vICMSUFDest) && !Number.isFinite(difal.vFCPUFDest)) return null;

  const pFcp = difal.pFCPUFDest ?? 0;
  const vFcp = difal.vFCPUFDest ?? 0;
  const pInterPart = difal.pICMSInterPart ?? 100;
  const vRemet = difal.vICMSUFRemet ?? 0;

  const node: XmlObject = {
    vBCUFDest: formatMoney2(difal.vBCUFDest),
    pICMSUFDest: formatMoney4(difal.pICMSUFDest),
    pICMSInter: difal.pICMSInter.toFixed(2),
    pICMSInterPart: pInterPart.toFixed(2),
    vICMSUFDest: formatMoney2(difal.vICMSUFDest),
    vICMSUFRemet: formatMoney2(vRemet),
  };
  if (pFcp > 0) {
    node.pFCPUFDest = formatMoney4(pFcp);
    node.vFCPUFDest = formatMoney2(vFcp);
  }

  return { ICMSUFDest: node };
}

function pisCofinsFromSnapshot(
  fiscal: Record<string, unknown>,
  emitter: ReturnType<typeof resolveEmitterFromPayload>,
): ReturnType<typeof resolvePisCofinsFromEngine> {
  const pis = (fiscal.pis as Record<string, unknown> | undefined) ?? {};
  const cofins = (fiscal.cofins as Record<string, unknown> | undefined) ?? {};
  const vBc = asNum(pis.vBc, emitter.bases.vBcPisCofins);
  const pPis = asNum(pis.aliquota, 0);
  const pCofins = asNum(cofins.aliquota, 0);
  const vPis = Math.round(vBc * (pPis / 100) * 100) / 100;
  const vCofins = Math.round(vBc * (pCofins / 100) * 100) / 100;
  const cstPis = typeof pis.st === "string" ? pis.st.slice(0, 2) : "09";
  const cstCofins = typeof cofins.st === "string" ? cofins.st.slice(0, 2) : "09";
  return resolvePisCofinsFromEngine(
    { cst: cstPis, vBC: vBc, pPIS: pPis, vPIS: vPis, vCOFINS: 0, aliquota: pPis },
    { cst: cstCofins, vBC: vBc, pCOFINS: pCofins, vPIS: 0, vCOFINS: vCofins, aliquota: pCofins },
  );
}

function mergeImpostoParts(parts: Array<XmlObject | null | undefined>): XmlObject {
  const imposto: XmlObject = {};
  for (const part of parts) {
    if (part) Object.assign(imposto, part);
  }
  return imposto;
}

/**
 * Resolve `<imposto>` completo de um item usando resolvers fiscais AST.
 * Espelha `buildItemImpostoXml` do gerador legado.
 */
export function buildItemImpostoNode(input: ItemImpostoInput): XmlObject {
  const {
    engineItem,
    fiscal,
    emitter,
    icmsSnapshotFallback,
    ibsCbsMode,
    ibsCbsVBc,
    vTotTrib,
  } = input;
  const { orig, icms, vBcIcms, valorIcms } = icmsSnapshotFallback;
  const ibsCbs = (fiscal.ibsCbs as Record<string, unknown> | undefined) ?? {};

  const parts: Array<XmlObject | null | undefined> = [];

  if (vTotTrib != null && vTotTrib > 0) {
    parts.push({ vTotTrib: vTotTrib.toFixed(2) });
  } else if (ibsCbsMode === "remessa") {
    parts.push({ vTotTrib: "0.00" });
  }

  if (engineItem) {
    parts.push(resolveIcmsFromEngine(engineItem.icms));
    if (engineItem.difal) {
      parts.push(resolveIcmsUfDestFromEngine(engineItem.difal));
    }
    if (engineItem.ipi) {
      parts.push(resolveIpiFromEngine(engineItem.ipi));
    } else {
      const ipiSnap = (fiscal.ipi as Record<string, unknown> | undefined) ?? {};
      parts.push(
        ipiSnap.st != null || ipiSnap.codEnq != null
          ? resolveIpiFromSnapshot(ipiSnap, emitter.bases.vBcIpi)
          : resolveIpiInt(),
      );
    }
    const pisCofins = resolvePisCofinsFromEngine(engineItem.pis, engineItem.cofins);
    parts.push(pisCofins.pis, pisCofins.cofins);
  } else {
    const icmsSnap = icms ?? { cst: "00", aliquota: 0 };
    parts.push(
      resolveIcmsFromSnapshot(icmsSnap, { orig, valor: vBcIcms, valorIcms }),
    );
    const ipiSnap = (fiscal.ipi as Record<string, unknown> | undefined) ?? {};
    parts.push(
      ipiSnap.st != null || ipiSnap.codEnq != null
        ? resolveIpiFromSnapshot(ipiSnap, emitter.bases.vBcIpi)
        : resolveIpiInt(),
    );
    const pisCofins = pisCofinsFromSnapshot(fiscal, emitter);
    parts.push(pisCofins.pis, pisCofins.cofins);

    const difalSnap = (fiscal.difal as Record<string, unknown> | undefined) ?? {};
    if (difalSnap.vBCUFDest != null) {
      parts.push(
        resolveIcmsUfDestFromEngine({
          vBCUFDest: asNum(difalSnap.vBCUFDest, 0),
          pFCPUFDest: asNum(difalSnap.pFCPUFDest, 0),
          pICMSUFDest: asNum(difalSnap.pICMSUFDest, 0),
          pICMSInter: asNum(difalSnap.pICMSInter, 0),
          pICMSInterPart: asNum(difalSnap.pICMSInterPart, 100),
          vFCPUFDest: asNum(difalSnap.vFCPUFDest, 0),
          vICMSUFDest: asNum(difalSnap.vICMSUFDest, 0),
          vICMSUFRemet: asNum(difalSnap.vICMSUFRemet, 0),
        }),
      );
    }
  }

  if (ibsCbsMode === "venda") {
    parts.push(resolveIbsCbsImpostoVenda(ibsCbs, ibsCbsVBc ?? null));
  } else {
    parts.push(resolveIbsCbsImpostoRemessa(ibsCbs, ibsCbsVBc ?? null));
  }

  return { imposto: mergeImpostoParts(parts) };
}
