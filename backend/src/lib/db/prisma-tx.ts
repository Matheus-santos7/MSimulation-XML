import type { PrismaClient } from "../../generated/prisma/client.js";

/**
 * Cliente Prisma dentro de `$transaction` interativo.
 * Mesmos delegates do `PrismaClient`, sem métodos de conexão/extensão.
 */
export type PrismaTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

/** Transações fiscais com múltiplas notas (avanço CD, cadeia de venda). */
export const FISCAL_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 60_000,
} as const;

/** Define `app.tenant_id` na sessão usada pela transação (conexão do pool). */
async function applyTenantRls(tx: PrismaTx, tenantId: string): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, false)`;
}

/**
 * Transação fiscal com RLS do tenant na mesma conexão.
 * O hook HTTP define RLS na conexão inicial; `$transaction` pode usar outra do pool.
 */
export async function runFiscalTransaction<T>(
  prisma: PrismaClient,
  tenantId: string,
  fn: (tx: PrismaTx) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await applyTenantRls(tx, tenantId);
    return fn(tx);
  }, FISCAL_TRANSACTION_OPTIONS);
}
