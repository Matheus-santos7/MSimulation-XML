import assert from "node:assert/strict";
import { describe, it } from "vitest";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { runFiscalTransaction } from "../prisma-tx.js";
import { runWithDbContext } from "../tenant-rls.js";

class DomainFailure extends Error {}

/** Simula o Postgres: depois de um erro na transação, todo novo comando falha. */
function createFakePrisma() {
  const executedSql: string[] = [];
  const state = { aborted: false };
  const tx = {
    $executeRaw: async (strings: TemplateStringsArray) => {
      if (state.aborted) {
        throw new Error("current transaction is aborted, commands ignored until end of transaction block");
      }
      executedSql.push(strings.join("?"));

      return 0;
    },
  };
  const prisma = {
    $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
  };

  return { prisma: prisma as unknown as PrismaClient, executedSql, state };
}

describe("runWithDbContext", () => {
  it("propaga o erro original quando o callback falha e a transação fica abortada", async () => {
    const { prisma, state } = createFakePrisma();

    await assert.rejects(
      runWithDbContext(prisma, { tenantId: "tenant-1" }, async () => {
        state.aborted = true;
        throw new DomainFailure("registro duplicado");
      }),
      (error: unknown) => error instanceof DomainFailure && error.message === "registro duplicado",
    );
  });

  it("aplica tenant e usuário numa única instrução (set_config local à transação)", async () => {
    const { prisma, executedSql } = createFakePrisma();

    await runWithDbContext(prisma, { tenantId: "tenant-1", userId: "user-1" }, async () => "ok");

    assert.equal(executedSql.length, 1);
    assert.match(executedSql[0]!, /set_config\('app\.tenant_id', \?, true\)/);
    assert.match(executedSql[0]!, /set_config\('app\.user_id', \?, true\)/);
  });

  it("aplica só o usuário quando não há tenant", async () => {
    const { prisma, executedSql } = createFakePrisma();

    await runWithDbContext(prisma, { userId: "user-1" }, async () => "ok");

    assert.equal(executedSql.length, 1);
    assert.match(executedSql[0]!, /set_config\('app\.user_id', \?, true\)/);
    assert.doesNotMatch(executedSql[0]!, /app\.tenant_id/);
  });

  it("não executa set_config sem tenant nem usuário", async () => {
    const { prisma, executedSql } = createFakePrisma();

    await runWithDbContext(prisma, {}, async () => "ok");

    assert.equal(executedSql.length, 0);
  });

  it("não executa comandos extras depois do callback com sucesso", async () => {
    const { prisma, executedSql } = createFakePrisma();

    const result = await runWithDbContext(prisma, { tenantId: "tenant-1" }, async () => "ok");

    assert.equal(result, "ok");
    assert.equal(executedSql.length, 1);
  });
});

describe("runFiscalTransaction", () => {
  it("propaga o erro original quando o callback falha e a transação fica abortada", async () => {
    const { prisma, state } = createFakePrisma();

    await assert.rejects(
      runFiscalTransaction(prisma, "tenant-1", async () => {
        state.aborted = true;
        throw new DomainFailure("nota rejeitada");
      }),
      (error: unknown) => error instanceof DomainFailure && error.message === "nota rejeitada",
    );
  });
});
