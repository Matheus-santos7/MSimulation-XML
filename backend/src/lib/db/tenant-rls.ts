import { AsyncLocalStorage } from "node:async_hooks";
import type { PrismaClient } from "../../generated/prisma/client.js";

export type DbRequestContext = {
  tenantId?: string;
  userId?: string;
};

export const dbRequestContext = new AsyncLocalStorage<DbRequestContext>();

export function getDbRequestContext(): DbRequestContext | undefined {
  return dbRequestContext.getStore();
}

/** Define tenant/user no PostgreSQL para políticas RLS da requisição atual. */
export async function applyRlsContext(prisma: PrismaClient, ctx: DbRequestContext): Promise<void> {
  if (ctx.tenantId) {
    await prisma.$executeRaw`SELECT set_config('app.tenant_id', ${ctx.tenantId}, false)`;
  }
  if (ctx.userId) {
    await prisma.$executeRaw`SELECT set_config('app.user_id', ${ctx.userId}, false)`;
  }
}

/** Limpa contexto RLS ao final da requisição (evita vazamento entre requests no pool). */
export async function clearRlsContext(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRaw`SELECT set_config('app.tenant_id', '', false)`;
  await prisma.$executeRaw`SELECT set_config('app.user_id', '', false)`;
}

export async function runWithDbContext<T>(
  prisma: PrismaClient,
  ctx: DbRequestContext,
  fn: () => Promise<T>,
): Promise<T> {
  return dbRequestContext.run(ctx, async () => {
    await applyRlsContext(prisma, ctx);
    try {
      return await fn();
    } finally {
      await clearRlsContext(prisma);
    }
  });
}
