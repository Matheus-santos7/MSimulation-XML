/** Timeout de transações interativas (emissão fiscal, importações, rotas com RLS). */
export const DB_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 300_000,
} as const;
