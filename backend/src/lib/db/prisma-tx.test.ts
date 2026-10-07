import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { dbTransactionContext } from "./tenant-rls.js";
import {
  registerFiscalTransactionCommitHook,
  resetFiscalTransactionCommitHookForTests,
  runFiscalTransaction,
} from "./prisma-tx.js";

function createFakeDb() {
  const tx = { $executeRaw: async (..._args: unknown[]) => 0 };
  return {
    tx,
    db: {
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(tx),
    },
  };
}

describe("runFiscalTransaction — hook de commit fiscal", () => {
  afterEach(() => {
    resetFiscalTransactionCommitHookForTests();
  });

  it("dispara o hook após o commit real, com db e tenantId da chamada", async () => {
    const calls: Array<{ db: unknown; tenantId: string }> = [];
    registerFiscalTransactionCommitHook((db, tenantId) => {
      calls.push({ db, tenantId });
    });

    const { db } = createFakeDb();
    const result = await runFiscalTransaction(db as never, "tenant-1", async () => "ok");

    assert.equal(result, "ok");
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.db, db);
    assert.equal(calls[0]!.tenantId, "tenant-1");
  });

  it("não quebra a transação quando nenhum hook foi registrado (no-op padrão)", async () => {
    const { db } = createFakeDb();
    const result = await runFiscalTransaction(db as never, "tenant-1", async () => "ok");
    assert.equal(result, "ok");
  });

  it("não dispara o hook ao reutilizar uma transação ambiente (reentrância)", async () => {
    const calls: unknown[] = [];
    registerFiscalTransactionCommitHook(() => {
      calls.push(1);
    });

    const { db, tx } = createFakeDb();
    await dbTransactionContext.run(tx as never, async () => {
      const result = await runFiscalTransaction(db as never, "tenant-1", async () => "reentrante");
      assert.equal(result, "reentrante");
    });

    assert.equal(calls.length, 0);
  });

  it("um hook que lança síncronamente não derruba o resultado já comitado", async () => {
    registerFiscalTransactionCommitHook(() => {
      throw new Error("falha proposital no hook");
    });

    const { db } = createFakeDb();
    const result = await runFiscalTransaction(db as never, "tenant-1", async () => "ok-mesmo-assim");

    assert.equal(result, "ok-mesmo-assim");
  });
});
