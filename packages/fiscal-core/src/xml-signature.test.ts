import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSimulationXmlSignature,
  isValidBase64,
  simulationDigestValue,
  simulationProtDigVal,
  simulationSignatureValue,
  simulationX509Certificate,
} from "./xml-signature.js";

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
    assert.match(xml, /<X509Data>/);
    assert.match(xml, /<X509Certificate>[^<]+<\/X509Certificate>/);
    assert.doesNotMatch(xml, /<KeyName>/);
  });

  it("gera DigestValue e SignatureValue em Base64 válido", () => {
    const xml = buildSimulationXmlSignature("NFe123", "chave456");
    const digest = xml.match(/<DigestValue>([^<]+)<\/DigestValue>/)?.[1];
    const signature = xml.match(/<SignatureValue>([^<]+)<\/SignatureValue>/)?.[1];

    assert.ok(digest, "DigestValue ausente");
    assert.ok(signature, "SignatureValue ausente");
    assert.ok(isValidBase64(digest));
    assert.ok(isValidBase64(signature));
    assert.ok(!digest.includes("-"));
    assert.ok(!signature.includes("-"));
  });

  it("valores são determinísticos para o mesmo seed", () => {
    assert.equal(simulationDigestValue("abc"), simulationDigestValue("abc"));
    assert.equal(simulationSignatureValue("abc"), simulationSignatureValue("abc"));
    assert.equal(simulationX509Certificate("abc"), simulationX509Certificate("abc"));
    assert.notEqual(simulationDigestValue("abc"), simulationDigestValue("xyz"));
  });

  it("X509Certificate é Base64 válido", () => {
    const cert = simulationX509Certificate("chave-teste");
    assert.ok(isValidBase64(cert));
    assert.ok(cert.length > 500);
  });

  it("simulationProtDigVal gera digVal Base64 de 28 caracteres (SHA-1)", () => {
    const digVal = simulationProtDigVal("35260112345678000199550010000000011234567890");
    assert.equal(digVal.length, 28);
    assert.ok(isValidBase64(digVal));
    assert.ok(!digVal.includes("-"));
  });
});
