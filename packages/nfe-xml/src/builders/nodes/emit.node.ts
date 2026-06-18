/**
 * Node builder para o grupo `<emit>`.
 *
 * @module builders/nodes/emit.node
 */

import type { XmlObject } from "../../core/xml-serializer.js";
import type { EmitenteXml } from "../../types.js";
import { digitsOnly } from "./builder.util.js";

/** Monta nó `<emit>` com endereço do emitente. */
export function buildEmitNode(emit: EmitenteXml): XmlObject {
  const e = emit.endereco;

  const enderEmit: XmlObject = {
    xLgr: e.xLgr,
    nro: e.nro,
    xBairro: e.xBairro,
    cMun: e.cMun,
    xMun: e.xMun,
    UF: e.uf,
    CEP: digitsOnly(e.cep),
    cPais: e.cPais,
    xPais: e.xPais,
  };
  if (e.xCpl) enderEmit.xCpl = e.xCpl;
  if (e.fone) enderEmit.fone = digitsOnly(e.fone);

  const emitNode: XmlObject = {
    CNPJ: digitsOnly(emit.cnpj),
    xNome: emit.xNome,
    enderEmit,
    IE: digitsOnly(emit.ie),
    CRT: emit.crt,
  };
  if (emit.xFant) emitNode.xFant = emit.xFant;
  if (emit.iest) emitNode.IEST = digitsOnly(emit.iest);

  return { emit: emitNode };
}
