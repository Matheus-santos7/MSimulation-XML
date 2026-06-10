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
