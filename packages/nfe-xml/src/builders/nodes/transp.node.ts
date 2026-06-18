/**
 * Node builder para o grupo `<transp>`.
 *
 * @module builders/nodes/transp.node
 */

import type { XmlObject } from "../../core/xml-serializer.js";
import {
  resolveRemessaTranspVol,
  resolveTransportaFromFiscal,
} from "../../fiscal/fiscal-xml.util.js";
import { REMESSA_ML_TRANSPORTA } from "../../constants.js";
import type { resolveEmitterFromPayload } from "../../resolve-emitter.js";
import { digitsOnly } from "./builder.util.js";

export type TranspNodeInput = {
  modFrete: string;
  fiscal: Record<string, unknown>;
  quantidade: number;
};

/** Monta nó `<transp>` (frete e transportadora). */
export function buildTranspNode(input: TranspNodeInput): XmlObject {
  const { modFrete, fiscal, quantidade } = input;
  const transporta =
    fiscal.transporta != null || modFrete === "2"
      ? resolveTransportaFromFiscal(fiscal, REMESSA_ML_TRANSPORTA)
      : null;
  const vol = resolveRemessaTranspVol(quantidade, fiscal);

  const transp: XmlObject = { modFrete };

  if (transporta) {
    const transportaNode: XmlObject = {};
    if (transporta.cnpj?.trim()) transportaNode.CNPJ = digitsOnly(transporta.cnpj);
    if (transporta.xNome?.trim()) transportaNode.xNome = transporta.xNome;
    if (transporta.ie?.trim()) transportaNode.IE = digitsOnly(transporta.ie);
    if (transporta.xEnder?.trim()) transportaNode.xEnder = transporta.xEnder;
    if (transporta.xMun?.trim()) transportaNode.xMun = transporta.xMun;
    if (transporta.uf?.trim()) transportaNode.UF = transporta.uf;
    transp.transporta = transportaNode;
  }

  if (modFrete !== "9") {
    transp.vol = {
      qVol: vol.qVol ?? 1,
      pesoL: vol.pesoL.toFixed(3),
      pesoB: vol.pesoB.toFixed(3),
    };
  }

  return { transp };
}

/** Atalho usando emitter resolvido. */
export function buildTranspFromEmitter(
  emitter: ReturnType<typeof resolveEmitterFromPayload>,
  fiscal: Record<string, unknown>,
  quantidade: number,
): XmlObject {
  return buildTranspNode({
    modFrete: emitter.modFrete,
    fiscal,
    quantidade,
  });
}
