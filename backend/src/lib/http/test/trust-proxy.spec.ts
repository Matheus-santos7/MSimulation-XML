import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { resolveTrustProxy } from "../trust-proxy.js";

describe("resolveTrustProxy", () => {
  it("should trust one hop in production when TRUST_PROXY is unset (S-3)", () => {
    expect(resolveTrustProxy(undefined, true)).toBe(1);
    expect(resolveTrustProxy("  ", true)).toBe(1);
  });

  it("should trust nothing outside production when TRUST_PROXY is unset", () => {
    expect(resolveTrustProxy(undefined, false)).toBe(false);
  });

  it("should parse booleans, hop counts and address lists", () => {
    expect(resolveTrustProxy("true", true)).toBe(true);
    expect(resolveTrustProxy("false", true)).toBe(false);
    expect(resolveTrustProxy("2", false)).toBe(2);
    expect(resolveTrustProxy("10.0.0.0/8, 127.0.0.1", true)).toBe("10.0.0.0/8, 127.0.0.1");
  });

  it("should ignore client-chosen X-Forwarded-For entries beyond the trusted hop", async () => {
    const app = Fastify({ trustProxy: resolveTrustProxy(undefined, true) });
    app.get("/ip", (request) => ({ ip: request.ip }));

    const res = await app.inject({
      url: "/ip",
      remoteAddress: "10.0.0.1",
      headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.7" },
    });
    await app.close();

    expect(res.json()).toEqual({ ip: "203.0.113.7" });
  });
});
