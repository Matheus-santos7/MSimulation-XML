/** Perfil do destinatário para resolução de regra (`customerType` na planilha). */
export type CustomerType = "taxpayer" | "non_taxpayer";

/**
 * Tipo de transação fiscal.
 * - `sale` — venda ao consumidor (NF-e VENDA)
 * - `inbound` — remessa / envio de estoque (planilha XLSX)
 * - `symbolic_inbound_return` — retorno simbólico ML SALE (alias → `inbound`)
 * - `inbound_return` — retorno físico / NEGATIVE difference (alias → `inbound`)
 */
export type TransactionType = "sale" | "inbound" | "symbolic_inbound_return" | "inbound_return";
