import assert from "node:assert/strict";
import { test } from "node:test";
import { clientIpFromHeaders } from "./client-ip";

test("clientIpFromHeaders usa a entrada do proxy de borda, não a escolhida pelo cliente", () => {
  assert.equal(
    clientIpFromHeaders(new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" })),
    "203.0.113.7",
  );
  assert.equal(
    clientIpFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.7" })),
    "203.0.113.7",
  );
});

test("clientIpFromHeaders cai no X-Real-IP e devolve undefined sem cabeçalho", () => {
  assert.equal(clientIpFromHeaders(new Headers({ "x-real-ip": "198.51.100.2" })), "198.51.100.2");
  assert.equal(clientIpFromHeaders(new Headers()), undefined);
});
