/**
 * Resolver puro de PIS/COFINS — retorna objetos AST, nunca strings XML.
 *
 * Espelha `buildPisCofinsXmlFromEngine` em `fiscal-engine-xml.ts`.
 * A escolha do grupo (NT, Outr ou Aliq) depende do par CST PIS+COFINS,
 * não de cada imposto isoladamente.
 *
 * @module taxes/pis-cofins.resolver
 */

import type { NfePisCofinsImposto } from "../core/nfe-ast.types.js";
import type { EnginePisCofins } from "../fiscal-engine-xml.js";
import { formatMoney2, formatMoney4, cst2Digits } from "./tax-format.util.js";

const PIS_COFINS_NT = new Set(["04", "05", "06", "07", "08", "09"]);
const PIS_COFINS_OUTR = new Set(["49", "98", "99"]);

type PisCofinsGroup = "nt" | "outr" | "aliq";

type PisNodeValues = {
  vBC: number;
  pPIS: number;
  vPIS: number;
};

type CofinsNodeValues = {
  vBC: number;
  pCOFINS: number;
  vCOFINS: number;
};

function resolvePisCofinsGroup(cstPis: string, cstCofins: string): PisCofinsGroup {
  if (PIS_COFINS_NT.has(cstPis) && PIS_COFINS_NT.has(cstCofins)) return "nt";
  if (PIS_COFINS_OUTR.has(cstPis) || PIS_COFINS_OUTR.has(cstCofins)) return "outr";
  return "aliq";
}

function buildPisNode(
  group: PisCofinsGroup,
  cst: string,
  values: PisNodeValues,
): NfePisCofinsImposto["pis"] {
  if (group === "nt") {
    return { PIS: { PISNT: { CST: cst } } };
  }
  if (group === "outr") {
    return {
      PIS: {
        PISOutr: {
          CST: cst,
          vBC: formatMoney2(values.vBC),
          pPIS: formatMoney4(values.pPIS),
          vPIS: formatMoney2(values.vPIS),
        },
      },
    };
  }
  return {
    PIS: {
      PISAliq: {
        CST: cst,
        vBC: formatMoney2(values.vBC),
        pPIS: formatMoney4(values.pPIS),
        vPIS: formatMoney2(values.vPIS),
      },
    },
  };
}

function buildCofinsNode(
  group: PisCofinsGroup,
  cst: string,
  values: CofinsNodeValues,
): NfePisCofinsImposto["cofins"] {
  if (group === "nt") {
    return { COFINS: { COFINSNT: { CST: cst } } };
  }
  if (group === "outr") {
    return {
      COFINS: {
        COFINSOutr: {
          CST: cst,
          vBC: formatMoney2(values.vBC),
          pCOFINS: formatMoney4(values.pCOFINS),
          vCOFINS: formatMoney2(values.vCOFINS),
        },
      },
    };
  }
  return {
    COFINS: {
      COFINSAliq: {
        CST: cst,
        vBC: formatMoney2(values.vBC),
        pCOFINS: formatMoney4(values.pCOFINS),
        vCOFINS: formatMoney2(values.vCOFINS),
      },
    },
  };
}

/**
 * Resolve nós `<PIS>` e `<COFINS>` conforme CST da engine.
 * Replica a ramificação conjunta de `buildPisCofinsXmlFromEngine`.
 */
export function resolvePisCofinsFromEngine(
  pis: EnginePisCofins,
  cofins: EnginePisCofins,
): NfePisCofinsImposto {
  const cstPis = cst2Digits(String(pis.cst ?? "01"));
  const cstCofins = cst2Digits(String(cofins.cst ?? "01"));
  const pPis = pis.pPIS ?? pis.aliquota ?? 0;
  const pCofins = cofins.pCOFINS ?? cofins.aliquota ?? 0;
  const group = resolvePisCofinsGroup(cstPis, cstCofins);

  return {
    pis: buildPisNode(group, cstPis, { vBC: pis.vBC, pPIS: pPis, vPIS: pis.vPIS }),
    cofins: buildCofinsNode(group, cstCofins, {
      vBC: cofins.vBC,
      pCOFINS: pCofins,
      vCOFINS: cofins.vCOFINS,
    }),
  };
}
