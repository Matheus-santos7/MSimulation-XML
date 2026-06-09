import { SignedXml } from "xml-crypto";
import { SIMULATION_CERTIFICATE_PEM, SIMULATION_PRIVATE_KEY_PEM } from "./simulation-credentials.js";

const XMLDSIG_NS = "http://www.w3.org/2000/09/xmldsig#";
const C14N = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const SIGNATURE_RE = /<Signature xmlns="http:\/\/www\.w3\.org\/2000\/09\/xmldsig#">[\s\S]*?<\/Signature>/;

export type FiscalSignatureDocumentConfig = {
  signedLocalName: string;
  parentLocalName: string;
  rootTag: string;
  rootAttrs?: string;
  xmlns: string;
  parentAttrs?: string;
};

export const NFE_SIGNATURE_CONFIG: FiscalSignatureDocumentConfig = {
  signedLocalName: "infNFe",
  parentLocalName: "NFe",
  rootTag: "nfeProc",
  rootAttrs: ' versao="4.00"',
  xmlns: "http://www.portalfiscal.inf.br/nfe",
};

export const CTE_SIGNATURE_CONFIG: FiscalSignatureDocumentConfig = {
  signedLocalName: "infCte",
  parentLocalName: "CTe",
  rootTag: "cteProc",
  rootAttrs: ' versao="4.00"',
  xmlns: "http://www.portalfiscal.inf.br/cte",
};

export const INUT_SIGNATURE_CONFIG: FiscalSignatureDocumentConfig = {
  signedLocalName: "infInut",
  parentLocalName: "inutNFe",
  rootTag: "procInutNFe",
  rootAttrs: ' versao="4.00"',
  xmlns: "http://www.portalfiscal.inf.br/nfe",
  parentAttrs: ' xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"',
};

export const EVENTO_SIGNATURE_CONFIG: FiscalSignatureDocumentConfig = {
  signedLocalName: "infEvento",
  parentLocalName: "evento",
  rootTag: "procEventoNFe",
  rootAttrs: ' versao="1.00"',
  xmlns: "http://www.portalfiscal.inf.br/nfe",
  parentAttrs: ' xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"',
};

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function deterministicBytes(seed: string, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let state = fnv1a(seed);
  for (let i = 0; i < length; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state = state >>> 0;
    out[i] = state & 0xff;
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    const triplet = (b0 << 16) | (b1 << 8) | b2;
    result += BASE64_ALPHABET[(triplet >> 18) & 63];
    result += BASE64_ALPHABET[(triplet >> 12) & 63];
    result += i + 1 < bytes.length ? BASE64_ALPHABET[(triplet >> 6) & 63] : "=";
    result += i + 2 < bytes.length ? BASE64_ALPHABET[triplet & 63] : "=";
  }
  return result;
}

/** DigestValue (SHA-1, 20 bytes) determinístico em Base64 válido — apenas simulação. */
export function simulationDigestValue(seed: string): string {
  return bytesToBase64(deterministicBytes(`simulation-digest:${seed}`, 20));
}

/** digVal do protNFe/protCTe (SHA-1, 20 bytes) em Base64 válido — apenas simulação. */
export function simulationProtDigVal(chave: string): string {
  return simulationDigestValue(`prot-digval:${chave}`);
}

function buildDocumentForSigning(signedElementXml: string, config: FiscalSignatureDocumentConfig): string {
  const parentOpen = config.parentAttrs
    ? `<${config.parentLocalName}${config.parentAttrs}>`
    : `<${config.parentLocalName}>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<${config.rootTag}${config.rootAttrs ?? ""} xmlns="${config.xmlns}">
  ${parentOpen}
${signedElementXml}
  </${config.parentLocalName}>
</${config.rootTag}>`;
}

function createSignedXml(): SignedXml {
  return new SignedXml({
    privateKey: SIMULATION_PRIVATE_KEY_PEM,
    publicCert: SIMULATION_CERTIFICATE_PEM,
    signatureAlgorithm: `${XMLDSIG_NS}rsa-sha1`,
    canonicalizationAlgorithm: C14N,
  });
}

/**
 * Assinatura XML-DSig real com certificado de simulação embutido.
 * O elemento assinado deve ser idêntico ao que aparece no documento final.
 */
export function buildSimulationXmlSignature(
  referenceId: string,
  signedElementXml: string,
  config: FiscalSignatureDocumentConfig,
  indent = "",
): string {
  const documentXml = buildDocumentForSigning(signedElementXml, config);
  const sig = createSignedXml();
  sig.addReference({
    xpath: `//*[local-name()='${config.signedLocalName}' and @Id='${referenceId}']`,
    transforms: [`${XMLDSIG_NS}enveloped-signature`, C14N],
    digestAlgorithm: `${XMLDSIG_NS}sha1`,
    uri: `#${referenceId}`,
  });
  sig.computeSignature(documentXml, {
    location: { reference: `//*[local-name()='${config.parentLocalName}']`, action: "append" },
  });
  const signature = sig.getSignedXml().match(SIGNATURE_RE)?.[0];
  if (!signature) {
    throw new Error(`Falha ao gerar assinatura para ${referenceId}`);
  }
  return indent ? `${indent}${signature}` : signature;
}

/** Remove assinatura anterior e insere assinatura criptográfica válida. */
export function injectSimulationSignature(xml: string, config: FiscalSignatureDocumentConfig): string {
  const signedRe = new RegExp(
    `(<${config.signedLocalName}\\s+Id="([^"]+)"[^>]*>[\\s\\S]*?</${config.signedLocalName}>)`,
  );
  const match = xml.match(signedRe);
  if (!match) return xml;

  const signedElementXml = match[1]!;
  const referenceId = match[2]!;
  const stripped = xml.replace(SIGNATURE_RE, "");
  const multiline = xml.includes("\n");
  const signature = buildSimulationXmlSignature(
    referenceId,
    signedElementXml,
    config,
    multiline ? "    " : "",
  );
  const glue = multiline ? `\n${signature}` : signature;
  return stripped.replace(signedElementXml, `${signedElementXml}${glue}`);
}

/** Verifica assinatura XML-DSig com o certificado de simulação (uso em testes). */
export function verifySimulationXmlSignature(xml: string): boolean {
  const signature = xml.match(SIGNATURE_RE)?.[0];
  if (!signature) return false;
  const verifier = new SignedXml({ publicCert: SIMULATION_CERTIFICATE_PEM });
  verifier.loadSignature(signature);
  return verifier.checkSignature(xml);
}

export function isValidBase64(value: string): boolean {
  if (!BASE64_RE.test(value) || value.length % 4 !== 0) return false;
  const pad = value.match(/=+$/)?.[0]?.length ?? 0;
  return pad <= 2;
}
