/**
 * Node builder para `<protCTe>` do CT-e simulado.
 *
 * @module cte-xml/cte-prot.node
 */

import { simulationNProt } from "../nprot.js";
import { simulationProtDigVal } from "../xml-signature.js";
import type { XmlObject } from "../xml-serializer.js";

export type CteProtNodeInput = {
  chave: string;
  numero: number;
  dhEmi: string;
  status: string;
};

/** Monta protocolo de autorização simulado. */
export function buildCteProtNode(input: CteProtNodeInput): XmlObject {
  const autorizada = input.status === "AUTORIZADA";

  return {
    protCTe: {
      "@versao": "4.00",
      infProt: {
        tpAmb: 2,
        verAplic: "SIMULATION-CTe",
        chCTe: input.chave,
        dhRecbto: input.dhEmi,
        nProt: simulationNProt(input.numero, "333260367974"),
        digVal: simulationProtDigVal(input.chave),
        cStat: autorizada ? 100 : 103,
        xMotivo: autorizada ? "Autorizado o uso do CT-e (SIMULAÇÃO)" : input.status,
      },
    },
  };
}
