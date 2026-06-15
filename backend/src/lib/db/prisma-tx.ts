import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  applyRlsContext,
  clearRlsContext,
  dbTransactionContext,
  type PrismaTransactionClient,
} from "./tenant-rls.js";
import { DB_TRANSACTION_OPTIONS } from "./transaction-options.js";

/**
 * Cliente Prisma dentro de `$transaction` interativo.
 * Mesmos delegates do `PrismaClient`, sem métodos de conexão/extensão.
 */
export type PrismaTx = PrismaTransactionClient;

/** Cliente de banco usado em requisições HTTP (transação) ou scripts (PrismaClient). */
export type DbClient = PrismaClient | PrismaTx;

/** Executa `fn` em transação quando `db` é PrismaClient; reutiliza tx quando já estiver em uma. */
export async function runInTransaction<T>(
  db: DbClient,
  fn: (tx: PrismaTx) => Promise<T>,
): Promise<T> {
  if ("$transaction" in db && typeof db.$transaction === "function") {
    return db.$transaction(fn, DB_TRANSACTION_OPTIONS);
  }
  return fn(db);
}

/** Transações fiscais com múltiplas notas (avanço CD, cadeia de venda). */
export const FISCAL_TRANSACTION_OPTIONS = DB_TRANSACTION_OPTIONS;

/**
 * Transação fiscal com RLS do tenant na mesma conexão.
 * Reutiliza a transação HTTP quando já estiver dentro de `runWithDbContext`.
 */
export async function runFiscalTransaction<T>(
  db: DbClient,
  tenantId: string,
  fn: (tx: PrismaTx) => Promise<T>,
): Promise<T> {
  const existingTx = dbTransactionContext.getStore();
  if (existingTx) {
    return fn(existingTx);
  }

  if ("$transaction" in db && typeof db.$transaction === "function") {
    return db.$transaction(async (tx) => {
      await applyRlsContext(tx, { tenantId });
      try {
        return await dbTransactionContext.run(tx, () => fn(tx));
      } finally {
        await clearRlsContext(tx);
      }
    }, FISCAL_TRANSACTION_OPTIONS);
  }

  return fn(db);
}
