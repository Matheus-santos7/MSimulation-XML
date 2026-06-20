import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { resolveFiscalValidatorApiUrl } from "./fiscal-validator-config.js";

describe("resolveFiscalValidatorApiUrl", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("returns full URL unchanged (without trailing slash)", () => {
    process.env = { ...env, FISCAL_VALIDATOR_URL: "https://validator.example.com/" };
    assert.equal(resolveFiscalValidatorApiUrl(), "https://validator.example.com");
  });

  it("prefixes http when env is host:port (Render private network)", () => {
    process.env = { ...env, FISCAL_VALIDATOR_URL: "msimulation-xml-fiscal-validator:10000" };
    assert.equal(resolveFiscalValidatorApiUrl(), "http://msimulation-xml-fiscal-validator:10000");
  });

  it("falls back to localhost in dev", () => {
    process.env = { ...env };
    delete process.env.FISCAL_VALIDATOR_URL;
    delete process.env.FISCAL_VALIDATOR_HOSTPORT;
    assert.equal(resolveFiscalValidatorApiUrl(), "http://localhost:8080");
  });
});
