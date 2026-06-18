/**
 * Resolver puro de IPI — retorna objetos AST, nunca strings XML.
 *
 * Espelha:
 * - `impostoIpiIntXml` em `nfe-xml-blocks.ts` (IPI não tributado / remessa)
 * - `buildIpiXmlFromEngine` e `buildIpiXmlFromFiscalSnapshot` em `fiscal-engine-xml.ts`
 *
 * @module taxes/ipi.resolver
 */

import type { NfeIpiImposto } from "../core/nfe-ast.types.js";
import {
  fiscalCodeText,
  isIpiNaoTributadoCst,
  type EngineIpi,
} from "../fiscal-engine-xml.js";
import { roundMoney, asNumeric, formatMoney2, formatMoney4, cst2Digits } from "./tax-format.util.js";

function startsWithTaxCode(value: unknown, prefix: string): boolean {
  return typeof value === "string" && value.trim().startsWith(prefix);
}

/**
 * Resolve `<IPI>` com grupo `<IPINT>` (não tributado).
 * Espelha `impostoIpiIntXml(cst, cEnq)` — defaults CST `55`, cEnq `103`.
 */
export function resolveIpiInt(cst = "55", cEnq = "103"): NfeIpiImposto {
  return {
    IPI: {
      cEnq,
      IPINT: { CST: cst },
    },
  };
}

/**
 * Resolve `<IPI>` a partir do item da engine fiscal.
 * Espelha `buildIpiXmlFromEngine`.
 */
export function resolveIpiFromEngine(ipi: EngineIpi): NfeIpiImposto {
  const cst = cst2Digits(ipi.cst);
  const cEnq = ipi.cEnq ?? "999";

  if (isIpiNaoTributadoCst(cst)) {
    return { IPI: { cEnq, IPINT: { CST: cst } } };
  }

  return {
    IPI: {
      cEnq,
      IPITrib: {
        CST: cst,
        vBC: formatMoney2(ipi.vBC),
        pIPI: formatMoney4(ipi.pIPI),
        vIPI: formatMoney2(ipi.vIPI),
      },
    },
  };
}

/**
 * Resolve `<IPI>` a partir de snapshot fiscal (sem engine item).
 * Espelha `buildIpiXmlFromFiscalSnapshot`.
 */
export function resolveIpiFromSnapshot(
  ipi: Record<string, unknown>,
  vBcFallback: number,
): NfeIpiImposto {
  const cstIpi =
    typeof ipi.st === "string"
      ? cst2Digits(ipi.st)
      : cst2Digits(fiscalCodeText(ipi.st, "55"));
  const cEnq = fiscalCodeText(ipi.codEnq, "103");

  if (
    startsWithTaxCode(ipi.st, "55") ||
    startsWithTaxCode(ipi.st, "54") ||
    startsWithTaxCode(ipi.st, "53")
  ) {
    return resolveIpiInt(cstIpi, cEnq);
  }

  if (isIpiNaoTributadoCst(cstIpi)) {
    return resolveIpiFromEngine({ cst: cstIpi, cEnq, vBC: 0, pIPI: 0, vIPI: 0 });
  }

  const vBcIpi = asNumeric(ipi.vBc, vBcFallback);
  const pIpi = asNumeric(ipi.aliquota, 0);
  const vIpi = roundMoney(vBcIpi * (pIpi / 100));
  return resolveIpiFromEngine({ cst: cstIpi, cEnq, vBC: vBcIpi, pIPI: pIpi, vIPI: vIpi });
}
