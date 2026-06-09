import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSimulationXmlSignature } from "./xml-signature.js";

describe("buildSimulationXmlSignature", () => {
  it("inclui Transforms e DigestMethod antes de DigestValue", () => {
    const xml = buildSimulationXmlSignature("NFe35260612345678000199550010000000011000000012", "chave123");
    const refStart = xml.indexOf("<Reference");
    const refEnd = xml.indexOf("</Reference>") + "</Reference>".length;
    const reference = xml.slice(refStart, refEnd);

    assert.match(reference, /<Transforms>/);
    assert.match(reference, /enveloped-signature/);
    assert.match(reference, /<DigestMethod Algorithm="http:\/\/www\.w3\.org\/2000\/09\/xmldsig#sha1"\/>/);
    assert.ok(reference.indexOf("<DigestMethod") < reference.indexOf("<DigestValue>"));
    assert.match(xml, /<KeyName>FAKE-SIMULATION-ONLY<\/KeyName>/);
  });
});
