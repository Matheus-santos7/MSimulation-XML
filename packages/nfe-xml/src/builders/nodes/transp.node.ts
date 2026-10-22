/**
 * Node builder para o grupo `<transp>`.
 *
 * @module builders/nodes/transp.node
 */

import type { XmlObject } from "../../core/xml-serializer.js";
import {
  resolveRemessaTranspVol,
  resolveTransportaFromFiscal,
  type NfeTransportaInput,
} from "../../fiscal/fiscal-xml.util.js";
import type { resolveEmitterFromPayload } from "../../resolve-emitter.js";
import { digitsOnly } from "./builder.util.js";

/** Sem transportador no perfil: só os campos que vierem no payload entram no XML. */
const NO_TRANSPORTADOR: NfeTransportaInput = { xNome: "" };

export type TranspNodeInput = {
  modFrete: string;
  fiscal: Record<string, unknown>;
  quantidade: number;
  /** Transportador do perfil do marketplace, usado quando o payload não traz um. */
  transportadorPadrao: NfeTransportaInput | null;
};

/** Monta nó `<transp>` (frete e transportadora). */
export function buildTranspNode(input: TranspNodeInput): XmlObject {
  const { modFrete, fiscal, quantidade, transportadorPadrao } = input;
  const wantsTransporta = fiscal.transporta != null || modFrete === "2";
  const hasSource = transportadorPadrao != null || fiscal.transporta != null;
  const transporta =
    wantsTransporta && hasSource
      ? resolveTransportaFromFiscal(fiscal, transportadorPadrao ?? NO_TRANSPORTADOR)
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
  transportadorPadrao: NfeTransportaInput | null,
): XmlObject {
  return buildTranspNode({
    modFrete: emitter.modFrete,
    fiscal,
    quantidade,
    transportadorPadrao,
  });
}
