const XMLDSIG_NS = "http://www.w3.org/2000/09/xmldsig#";
const C14N = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

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

/** SignatureValue determinístico em Base64 válido (256 bytes, ~RSA-2048) — apenas simulação. */
export function simulationSignatureValue(seed: string): string {
  return bytesToBase64(deterministicBytes(`simulation-signature:${seed}`, 256));
}

/**
 * Bloco <Signature> estruturalmente válido (XML-DSig) para simulação.
 * DigestValue e SignatureValue são Base64 válidos; KeyName permanece explícito como fake.
 */
export function buildSimulationXmlSignature(referenceId: string, digestSeed: string, indent = ""): string {
  const digest = simulationDigestValue(digestSeed);
  const signature = simulationSignatureValue(digestSeed);
  const uri = referenceId.startsWith("#") ? referenceId : `#${referenceId}`;
  const i = indent;
  const ii = `${indent}  `;
  const iii = `${indent}    `;
  const iiii = `${indent}      `;

  return `${i}<Signature xmlns="${XMLDSIG_NS}">
${ii}<SignedInfo>
${iii}<CanonicalizationMethod Algorithm="${C14N}"/>
${iii}<SignatureMethod Algorithm="${XMLDSIG_NS}rsa-sha1"/>
${iii}<Reference URI="${uri}">
${iiii}<Transforms>
${iiii}  <Transform Algorithm="${XMLDSIG_NS}enveloped-signature"/>
${iiii}  <Transform Algorithm="${C14N}"/>
${iiii}</Transforms>
${iiii}<DigestMethod Algorithm="${XMLDSIG_NS}sha1"/>
${iiii}<DigestValue>${digest}</DigestValue>
${iii}</Reference>
${ii}</SignedInfo>
${ii}<SignatureValue>${signature}</SignatureValue>
${ii}<KeyInfo><KeyName>FAKE-SIMULATION-ONLY</KeyName></KeyInfo>
${i}</Signature>`;
}

export function isValidBase64(value: string): boolean {
  if (!BASE64_RE.test(value) || value.length % 4 !== 0) return false;
  const pad = value.match(/=+$/)?.[0]?.length ?? 0;
  return pad <= 2;
}
