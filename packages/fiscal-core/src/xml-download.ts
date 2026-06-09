import {
  CTE_SIGNATURE_CONFIG,
  EVENTO_SIGNATURE_CONFIG,
  injectSimulationSignature,
  INUT_SIGNATURE_CONFIG,
  NFE_SIGNATURE_CONFIG,
  type FiscalSignatureDocumentConfig,
} from "./xml-signature.js";

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

/** Detecta configuração de assinatura pelo envelope do documento fiscal. */
export function detectFiscalSignatureConfig(xml: string): FiscalSignatureDocumentConfig | null {
  if (xml.includes("<procEventoNFe")) return EVENTO_SIGNATURE_CONFIG;
  if (xml.includes("<procInutNFe")) return INUT_SIGNATURE_CONFIG;
  if (xml.includes("<cteProc")) return CTE_SIGNATURE_CONFIG;
  if (xml.includes("<nfeProc")) return NFE_SIGNATURE_CONFIG;
  return null;
}

/**
 * Prepara XML para download: uma linha + assinatura recalculada.
 * Compactar sem reassinar invalida o XML-DSig (o digest depende dos bytes exatos).
 */
export function prepareFiscalXmlForDownload(xml: string): string {
  const compact = compactXmlForDownload(xml);
  const config = detectFiscalSignatureConfig(compact);
  return config ? injectSimulationSignature(compact, config) : compact;
}
