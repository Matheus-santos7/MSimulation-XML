/**
 * Gerador XML CT-e v4.00 — simulação alinhada ao layout oficial (modelo ML).
 *
 * Monta o documento como objeto puro e serializa apenas na última etapa.
 */

import {
  CTE_SIGNATURE_CONFIG,
  injectSimulationSignature,
} from "./xml-signature.js";
import { serializeCteXmlDocument, type BuildCteXmlDocumentInput } from "./cte-xml/cte-xml.builder.js";

export type CTeXmlInput = BuildCteXmlDocumentInput;

/**
 * Gera XML autorizado simulado do CT-e com assinatura XML-DSig de simulação.
 */
export function buildCTeXML(cte: CTeXmlInput): string {
  const xml = serializeCteXmlDocument(cte);
  return injectSimulationSignature(xml, CTE_SIGNATURE_CONFIG);
}
