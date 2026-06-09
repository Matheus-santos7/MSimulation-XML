import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSimulationXmlSignature,
  injectSimulationSignature,
  isValidBase64,
  NFE_SIGNATURE_CONFIG,
  simulationProtDigVal,
  verifySimulationXmlSignature,
} from "./xml-signature.js";

const infNFe = `    <infNFe Id="NFe35260601490698006689550090000000011520294665" versao="4.00">
      <ide><cUF>35</cUF><natOp>test</natOp></ide>
    </infNFe>`;

describe("buildSimulationXmlSignature", () => {
  it("gera assinatura XML-DSig verificável", () => {
    const signature = buildSimulationXmlSignature(
      "NFe35260601490698006689550090000000011520294665",
      infNFe,
      NFE_SIGNATURE_CONFIG,
      "    ",
    );
    assert.match(signature, /<X509Data>/);
    assert.match(signature, /<X509Certificate>[^<]+<\/X509Certificate>/);
    assert.doesNotMatch(signature, /<KeyName>/);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
${infNFe}
${signature}
  </NFe>
</nfeProc>`;
    assert.equal(verifySimulationXmlSignature(xml), true);
  });

  it("injectSimulationSignature assina nfeProc sem assinatura prévia", () => {
    const unsigned = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
${infNFe}
  </NFe>
</nfeProc>`;
    const signed = injectSimulationSignature(unsigned, NFE_SIGNATURE_CONFIG);
    assert.match(signed, /<Signature xmlns="http:\/\/www\.w3\.org\/2000\/09\/xmldsig#">/);
    assert.equal(verifySimulationXmlSignature(signed), true);
  });

  it("simulationProtDigVal gera digVal Base64 de 28 caracteres (SHA-1)", () => {
    const digVal = simulationProtDigVal("35260112345678000199550010000000011234567890");
    assert.equal(digVal.length, 28);
    assert.ok(isValidBase64(digVal));
    assert.ok(!digVal.includes("-"));
  });
});
