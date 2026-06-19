import type { NFeTipoXml } from "./types.js";

/** Tipos que persistem XML na emissão (`NFe.xml_autorizado`). */
export const NFE_XML_PERSIST_SUPPORTED: readonly NFeTipoXml[] = [
  "REMESSA",
  "REMESSA_SIMBOLICA",
  "REMESSA_AVANCO",
  "RETORNO_SIMBOLICO",
  "VENDA",
  "DEVOLUCAO",
  "TRANSFERENCIA_FILIAL",
];

export function isNfeXmlPersistSupported(tipo: NFeTipoXml): boolean {
  return (NFE_XML_PERSIST_SUPPORTED as readonly string[]).includes(tipo);
}

export class UnsupportedNfeXmlTipoError extends Error {
  readonly tipo: NFeTipoXml;

  constructor(tipo: NFeTipoXml) {
    super(`Persistência de XML ainda não implementada para NF-e tipo ${tipo}`);
    this.name = "UnsupportedNfeXmlTipoError";
    this.tipo = tipo;
  }
}
