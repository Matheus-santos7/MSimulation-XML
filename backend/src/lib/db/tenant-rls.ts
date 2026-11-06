import { AsyncLocalStorage } from "node:async_hooks";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { DB_TRANSACTION_OPTIONS } from "./transaction-options.js";

export type DbRequestContext = {
  tenantId?: string;
  userId?: string;
};

export const dbRequestContext = new AsyncLocalStorage<DbRequestContext>();

export const dbTransactionContext = new AsyncLocalStorage<PrismaTransactionClient>();

export function getDbRequestContext(): DbRequestContext | undefined {
  return dbRequestContext.getStore();
}

export type PrismaTransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export function getDbClient(): PrismaTransactionClient {
  const tx = dbTransactionContext.getStore();
  if (!tx) {
    throw new Error("Database client accessed outside of an active transaction");
  }
  return tx;
}

/**
 * `set_config(..., true)` vale só até o fim da transação: commit e rollback já limpam, então
 * não há consulta de limpeza (que falharia numa transação abortada e esconderia o erro real).
 */
export async function applyRlsContext(
  tx: PrismaTransactionClient,
  ctx: DbRequestContext,
): Promise<void> {
  // Uma instrução só quando há os dois: cada comando é uma ida e volta ao banco (~150 ms no Neon).
  if (ctx.tenantId && ctx.userId) {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ctx.tenantId}, true), set_config('app.user_id', ${ctx.userId}, true)`;
  } else if (ctx.tenantId) {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ctx.tenantId}, true)`;
  } else if (ctx.userId) {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${ctx.userId}, true)`;
  }
}

export async function runWithDbContext<T>(
  prisma: PrismaClient,
  ctx: DbRequestContext,
  fn: (tx: PrismaTransactionClient) => Promise<T>,
): Promise<T> {
  return dbRequestContext.run(ctx, async () => {
    return await prisma.$transaction(async (tx) => {
      await applyRlsContext(tx, ctx);

      return await dbTransactionContext.run(tx, () => fn(tx));
    }, DB_TRANSACTION_OPTIONS);
  });
}
