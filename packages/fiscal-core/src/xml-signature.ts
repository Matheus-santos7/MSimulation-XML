const XMLDSIG_NS = "http://www.w3.org/2000/09/xmldsig#";
const C14N = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";

/**
 * Bloco <Signature> estruturalmente válido (XML-DSig) para simulação.
 * Valores criptográficos são fictícios; a ordem das tags segue o XSD da SEFAZ.
 */
export function buildSimulationXmlSignature(referenceId: string, digestSeed: string, indent = ""): string {
  const digest = `SIMULATION-${digestSeed.slice(-12)}`;
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
${ii}<SignatureValue>FAKE-SIGNATURE-FOR-SIMULATION-ONLY</SignatureValue>
${ii}<KeyInfo><KeyName>FAKE-SIMULATION-ONLY</KeyName></KeyInfo>
${i}</Signature>`;
}
