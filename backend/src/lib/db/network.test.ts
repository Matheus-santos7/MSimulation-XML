import assert from "node:assert/strict";
import net from "node:net";
import { afterEach, describe, it } from "node:test";
import { DB_CONNECT_ATTEMPT_TIMEOUT_MS, applyDbNetworkDefaults } from "./network.js";

const originalAttemptTimeout = net.getDefaultAutoSelectFamilyAttemptTimeout();

afterEach(() => {
  net.setDefaultAutoSelectFamilyAttemptTimeout(originalAttemptTimeout);
});

describe("applyDbNetworkDefaults", () => {
  it("raises the per-address connect attempt above Node's 250 ms default", () => {
    applyDbNetworkDefaults();

    assert.equal(net.getDefaultAutoSelectFamilyAttemptTimeout(), DB_CONNECT_ATTEMPT_TIMEOUT_MS);
    assert.ok(DB_CONNECT_ATTEMPT_TIMEOUT_MS >= 2_000);
  });

  it("keeps happy eyeballs enabled so IPv6-less hosts still fall back to IPv4", () => {
    applyDbNetworkDefaults();

    assert.equal(net.getDefaultAutoSelectFamily(), true);
  });
});
