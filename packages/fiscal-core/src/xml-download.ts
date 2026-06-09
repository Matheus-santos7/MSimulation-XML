export type FiscalXmlDownloadTipo = "NFe" | "CTe" | "Inut" | "Canc";

/** Nome de arquivo para download: `{tipo}_{chave}.xml`. */
export function fiscalXmlDownloadFilename(tipo: FiscalXmlDownloadTipo, chave: string): string {
  const safe = chave.replace(/[\r\n"\\/]/g, "_");
  return `${tipo}_${safe}.xml`;
}

/** Remove espaços e quebras entre tags; preserva o conteúdo dentro das tags. */
export function compactXmlForDownload(xml: string): string {
  return xml.replace(/>\s+</g, "><").trim();
}
