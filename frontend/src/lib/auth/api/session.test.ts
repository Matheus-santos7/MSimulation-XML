import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { fetchAuthMe } from "./session";

const originalFetch = globalThis.fetch;

function mockFetch(response: Response): void {
  globalThis.fetch = async () => response;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("fetchAuthMe", () => {
  it("returns the user when the API answers 200", async () => {
    mockFetch(Response.json({ id: "u1", email: "a@b.com" }));

    const me = await fetchAuthMe("token");

    assert.deepEqual(me, { id: "u1", email: "a@b.com" });
  });

  it("returns null when the token is rejected (401)", async () => {
    mockFetch(Response.json({ error: "Não autorizado" }, { status: 401 }));

    assert.equal(await fetchAuthMe("token"), null);
  });

  it("throws instead of returning null when the API is unavailable (503)", async () => {
    mockFetch(Response.json({ error: "Banco de dados indisponível" }, { status: 503 }));

    await assert.rejects(fetchAuthMe("token"), /indispon/i);
  });
});
