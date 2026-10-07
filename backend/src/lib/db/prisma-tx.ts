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
  const existingTx = dbTransactionContext.getStore();
  if (existingTx) {
    return fn(existingTx);
  }
  if ("$transaction" in db && typeof db.$transaction === "function") {
    return db.$transaction(fn, DB_TRANSACTION_OPTIONS);
  }
  return fn(db);
}

/** Transações fiscais com múltiplas notas (avanço CD, cadeia de venda). */
export const FISCAL_TRANSACTION_OPTIONS = DB_TRANSACTION_OPTIONS;

/** Efeito colateral disparado após o commit real de `runFiscalTransaction`. */
export type FiscalTransactionCommitHook = (db: DbClient, tenantId: string) => void;

let fiscalTransactionCommitHook: FiscalTransactionCommitHook | undefined;

/**
 * Registra o hook de pós-commit fiscal (ex.: acionar revalidação assíncrona
 * de NF-e). Chamado pelo composition root (`fiscal.plugin.ts`) para evitar
 * que `lib/db` — usado por ~60 módulos — importe módulos de domínio
 * (fiscal-validation/fiscal-documents) diretamente.
 */
export function registerFiscalTransactionCommitHook(hook: FiscalTransactionCommitHook): void {
  fiscalTransactionCommitHook = hook;
}

/** Reseta o hook de commit fiscal (uso exclusivo em testes). */
export function resetFiscalTransactionCommitHookForTests(): void {
  fiscalTransactionCommitHook = undefined;
}

/**
 * Transação fiscal com RLS do tenant na mesma conexão.
 * Reutiliza a transação HTTP quando já estiver dentro de `runWithDbContext`.
 *
 * O hook de commit só dispara quando esta chamada abre a transação de fato
 * (não na reentrância via `existingTx`): disparar antes do commit real
 * exporia dados ainda não visíveis a outras conexões.
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
    const result = await db.$transaction(async (tx) => {
      await applyRlsContext(tx, { tenantId });
      try {
        return await dbTransactionContext.run(tx, () => fn(tx));
      } finally {
        await clearRlsContext(tx);
      }
    }, FISCAL_TRANSACTION_OPTIONS);
    // O commit já aconteceu: uma falha aqui (síncrona ou assíncrona) é um
    // efeito colateral de melhor esforço e nunca deve virar erro para quem
    // chamou — o resultado da transação já é válido.
    try {
      fiscalTransactionCommitHook?.(db, tenantId);
    } catch {
      // Hook de pós-commit é fire-and-forget por design; erros síncronos
      // são responsabilidade de quem registrou o hook (ex.: app.log.error
      // em fiscal.plugin.ts). Nada a fazer aqui além de não propagar.
    }
    return result;
  }

  return fn(db);
}
