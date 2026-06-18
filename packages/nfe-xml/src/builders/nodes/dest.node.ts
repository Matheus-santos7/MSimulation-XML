/**
 * Node builder para o grupo `<dest>`.
 *
 * @module builders/nodes/dest.node
 */

import type { XmlObject } from "../../core/xml-serializer.js";
import type { DestinatarioXml } from "../../types.js";
import { digitsOnly } from "./builder.util.js";

export type DestNodeInput = {
  destinatario: DestinatarioXml;
  fiscal: Record<string, unknown>;
  /** Quando true, inclui `<IE>` se indIEDest === 1. */
  includeIe?: boolean;
};

function resolveDestIe(
  indIEDest: number,
  fiscal: Record<string, unknown>,
  ie?: string,
): string | undefined {
  if (indIEDest !== 1) return undefined;
  const raw =
    (typeof fiscal.destIe === "string" && fiscal.destIe) ||
    (typeof ie === "string" && ie) ||
    "";
  const digits = digitsOnly(String(raw));
  return digits || undefined;
}

/** Monta nó `<dest>` do destinatário. */
export function buildDestNode(input: DestNodeInput): XmlObject {
  const { destinatario: d, fiscal, includeIe = false } = input;
  const de = d.endereco;
  const docTag = d.docTipo === "CPF" ? "CPF" : "CNPJ";

  const enderDest: XmlObject = {
    xLgr: de.logradouro,
    nro: de.numero,
    xBairro: de.bairro,
    cMun: de.codigoMunicipio,
    xMun: de.municipio,
    UF: de.uf,
    CEP: digitsOnly(de.cep),
    cPais: de.codigoPais,
    xPais: de.nomePais,
  };
  const complemento = de.complemento?.trim() || (includeIe ? "Nao consta" : undefined);
  if (complemento) enderDest.xCpl = complemento;
  if (de.telefone) enderDest.fone = digitsOnly(de.telefone);

  const destNode: XmlObject = {
    [docTag]: digitsOnly(d.doc),
    xNome: d.nome,
    enderDest,
    indIEDest: d.indIEDest,
  };

  if (includeIe) {
    const ie = resolveDestIe(d.indIEDest, fiscal, d.ie);
    if (ie) destNode.IE = ie;
  }

  return { dest: destNode };
}
