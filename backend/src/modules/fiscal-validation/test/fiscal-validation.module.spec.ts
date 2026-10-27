import "reflect-metadata";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "vitest";
import type { FastifyBaseLogger } from "fastify";
import {
  resetFiscalTransactionCommitHookForTests,
  runFiscalTransaction,
} from "../../../lib/db/prisma-tx.js";
import { FiscalValidationModule } from "../fiscal-validation.module.js";
import type { NfeValidationBackfillUseCase } from "../nfe-validation/use-cases/nfe-validation-backfill.usecase.js";

const TENANT_ID = "tenant-1";

const fakeDb = {
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({ $executeRaw: async () => 0 }),
};

function moduleWith(execute: () => Promise<unknown>, errors: unknown[] = []) {
  const calls: Array<{ tenantId: string; limit?: number }> = [];
  const backfill = {
    execute: async (_db: unknown, tenantId: string, options: { limit?: number }) => {
      calls.push({ tenantId, limit: options.limit });

      return execute();
    },
  } as unknown as NfeValidationBackfillUseCase;
  const logger = {
    error: (...args: unknown[]) => errors.push(args),
  } as unknown as FastifyBaseLogger;

  return { module: new FiscalValidationModule(backfill, logger), calls };
}

describe("FiscalValidationModule", () => {
  afterEach(() => {
    resetFiscalTransactionCommitHookForTests();
  });

  it("registra o backfill de NF-e pendentes no pós-commit das transações fiscais", async () => {
    const { module, calls } = moduleWith(async () => ({ processed: 0 }));
    module.onModuleInit();

    await runFiscalTransaction(fakeDb as never, TENANT_ID, async () => "ok");

    assert.deepEqual(calls, [{ tenantId: TENANT_ID, limit: 10 }]);
  });

  it("registra no log a falha do backfill sem quebrar a transação", async () => {
    const errors: unknown[] = [];
    const { module } = moduleWith(async () => {
      throw new Error("validador fora do ar");
    }, errors);
    module.onModuleInit();

    const result = await runFiscalTransaction(fakeDb as never, TENANT_ID, async () => "ok");
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(result, "ok");
    assert.equal(errors.length, 1);
  });
});
