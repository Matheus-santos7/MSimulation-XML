import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAccessTokenFresh } from "./token-expiry";

const NOW_MS = 1_800_000_000_000;

function tokenWithPayload(payload: unknown): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${encoded}.signature`;
}

describe("isAccessTokenFresh", () => {
  it("accepts a token that expires well after the safety margin", () => {
    const token = tokenWithPayload({ exp: NOW_MS / 1000 + 600 });
    assert.equal(isAccessTokenFresh(token, NOW_MS), true);
  });

  it("rejects a token inside the safety margin", () => {
    const token = tokenWithPayload({ exp: NOW_MS / 1000 + 10 });
    assert.equal(isAccessTokenFresh(token, NOW_MS), false);
  });

  it("rejects an expired token", () => {
    const token = tokenWithPayload({ exp: NOW_MS / 1000 - 1 });
    assert.equal(isAccessTokenFresh(token, NOW_MS), false);
  });

  it("rejects a token without a numeric exp", () => {
    assert.equal(isAccessTokenFresh(tokenWithPayload({}), NOW_MS), false);
    assert.equal(isAccessTokenFresh(tokenWithPayload({ exp: "soon" }), NOW_MS), false);
  });

  it("rejects malformed tokens instead of throwing", () => {
    assert.equal(isAccessTokenFresh("not-a-jwt", NOW_MS), false);
    assert.equal(isAccessTokenFresh("a.!!!.c", NOW_MS), false);
    assert.equal(isAccessTokenFresh("", NOW_MS), false);
  });
});
