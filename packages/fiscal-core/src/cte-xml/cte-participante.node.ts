/**
 * Node builder para `<rem>` e `<dest>` do CT-e.
 *
 * @module cte-xml/cte-participante.node
 */

import type { CteParticipante } from "../cte-template.js";
import type { XmlObject } from "../xml-serializer.js";
import { digitsOnly, resolveParticipanteDoc } from "./cte-xml.util.js";

export type CteParticipanteRole = "rem" | "dest";

/**
 * Monta nó `<rem>` ou `<dest>` com endereço fiscal do participante.
 */
export function buildCteParticipanteNode(
  role: CteParticipanteRole,
  participante: CteParticipante,
): XmlObject {
  const { tag: docTag, value: docValue } = resolveParticipanteDoc(participante.doc);
  const enderTag = role === "rem" ? "enderReme" : "enderDest";
  const endereco = participante.endereco;

  const ender: XmlObject = {
    xLgr: endereco.logradouro,
    nro: endereco.numero,
    xBairro: endereco.bairro,
    cMun: endereco.codigoMunicipio,
    xMun: endereco.municipio,
    CEP: digitsOnly(endereco.cep),
    UF: endereco.uf,
  };

  if (endereco.complemento) {
    ender.xCpl = endereco.complemento;
  }

  const node: XmlObject = {
    [docTag]: docValue,
    xNome: participante.nome,
    [enderTag]: ender,
  };

  const ie = participante.ie ? digitsOnly(participante.ie) : "";
  if (ie.length > 0) {
    node.IE = ie;
  }

  return { [role]: node };
}
