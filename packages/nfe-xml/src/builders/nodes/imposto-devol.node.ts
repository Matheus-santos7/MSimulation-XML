/**
 * NT 2016.002 — `<impostoDevol>` (IPI devolvido por não contribuinte).
 *
 * @module builders/nodes/imposto-devol.node
 */

import type { XmlObject } from "../../core/xml-serializer.js";
import { formatMoney2 } from "../../taxes/tax-format.util.js";

export type ImpostoDevolInput = {
  pDevol: number;
  vIPIDevol: number;
};

/** Monta `<impostoDevol><pDevol/><IPI><vIPIDevol/></IPI></impostoDevol>`. */
export function buildImpostoDevolNode(input: ImpostoDevolInput | null | undefined): XmlObject | null {
  if (!input) return null;
  const v = input.vIPIDevol;
  const p = input.pDevol;
  if (!(v > 0) || !(p > 0)) return null;
  return {
    impostoDevol: {
      pDevol: formatMoney2(p),
      IPI: { vIPIDevol: formatMoney2(v) },
    },
  };
}
