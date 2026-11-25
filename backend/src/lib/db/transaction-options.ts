/**
 * Timeout de transações interativas (emissão fiscal, importações, rotas com RLS).
 *
 * A emissão mais longa em produção leva menos de 2 min; 150 s dá folga sem deixar uma transação
 * travada segurar uma das 10 conexões do pool por 5 min (P-3). Suba junto com a medição se a
 * emissão crescer.
 */
export const DB_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 150_000,
} as const;
