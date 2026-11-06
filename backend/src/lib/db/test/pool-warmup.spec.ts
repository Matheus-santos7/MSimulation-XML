import { describe, expect, it, vi } from "vitest";
import { warmUpPool } from "../pool-warmup.js";

function fakeClient() {
  return { release: vi.fn() };
}

describe("warmUpPool", () => {
  it("should open the requested number of connections and release them all", async () => {
    const opened = [fakeClient(), fakeClient(), fakeClient()];
    const queue = [...opened];
    const pool = { connect: vi.fn().mockImplementation(async () => queue.shift()!) };

    const connected = await warmUpPool(pool, 3);

    expect(pool.connect).toHaveBeenCalledTimes(3);
    expect(connected).toBe(3);
    for (const client of opened) expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("should release the connections that opened when another one fails", async () => {
    const ok = fakeClient();
    const pool = {
      connect: vi
        .fn()
        .mockResolvedValueOnce(ok)
        .mockRejectedValueOnce(new Error("connection refused")),
    };

    const connected = await warmUpPool(pool, 2);

    expect(connected).toBe(1);
    expect(ok.release).toHaveBeenCalledTimes(1);
  });
});
