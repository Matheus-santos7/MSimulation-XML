import { AsyncLocalStorage } from "node:async_hooks";
import type { PrismaClient } from "../../generated/prisma/client.js";

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
    throw new Error("Database client accessed outside of runWithDbContext");
  }
  return tx;
}

export async function applyRlsContext(
  tx: PrismaTransactionClient,
  ctx: DbRequestContext,
): Promise<void> {
  if (ctx.tenantId) {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ctx.tenantId}, false)`;
  }
  if (ctx.userId) {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${ctx.userId}, false)`;
  }
}

export async function clearRlsContext(tx: PrismaTransactionClient): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.tenant_id', '', false)`;
  await tx.$executeRaw`SELECT set_config('app.user_id', '', false)`;
}

export async function runWithDbContext<T>(
  prisma: PrismaClient,
  ctx: DbRequestContext,
  fn: (tx: PrismaTransactionClient) => Promise<T>,
): Promise<T> {
  return dbRequestContext.run(ctx, async () => {
    return await prisma.$transaction(async (tx) => {
      await applyRlsContext(tx, ctx);
      try {
        return await dbTransactionContext.run(tx, () => fn(tx));
      } finally {
        await clearRlsContext(tx);
      }
    });
  });
}
