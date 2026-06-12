/** Perfil do destinatário para resolução de regra (`customerType` na planilha). */
export type CustomerType = "taxpayer" | "non_taxpayer";

/**
 * Tipo de transação fiscal.
 * - `sale` — venda ao consumidor (NF-e VENDA)
 * - `inbound` — retorno simbólico, remessa, operações B2B para CD
 */
export type TransactionType = "sale" | "inbound";
