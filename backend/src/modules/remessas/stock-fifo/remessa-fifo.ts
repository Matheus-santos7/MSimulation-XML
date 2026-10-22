/**
 * Controle de saldo de remessas físicas (FIFO) por linha de NF-e (`nfe_itens`).
 *
 * Barrel das consultas de saldo. Outros módulos importam pelo `remessas/index.js`.
 */
export { SaldoRemessaInsuficienteError } from "./queries/remessa-fifo.errors.js";
export type { RemessaCdBalanceRow, PreviewRemessaFifoVenda } from "./types/remessa-fifo.types.js";
export {
  buildRemessaFifoItemWhere,
  buildRemessaFifoItemsWhere,
  collectRemessaSaldoProductIds,
  realignRemessaFifoProductIdsBySku,
} from "./queries/remessa-fifo-product-ids.js";
export { prepareRemessaFifoForOperation } from "./queries/remessa-fifo-item-sync.js";
export {
  getAvailableRemessaBalance,
  refreshRemessaFifoItemsForNfes,
  getNetRemessaNfeBalance,
  listRemessaBalanceByCd,
} from "./queries/remessa-fifo-balance-query.js";
export {
  resolveAdvanceFiscalOrigin,
  resolveFifoOriginUnitId,
} from "./queries/remessa-fifo-origin-resolver.js";
export {
  consumeRemessaFifoBalance,
  previewRemessaPrincipalFifoParaVenda,
  loadRemessaForReturnDestination,
  consumeRemessaFifoBalanceForSale,
  debitRemessaBalanceByCd,
  debitRemessaBalanceByNfeId,
  reverseRemessaFifoConsumptions,
  reverseRemessaFifoConsumptionsForReturn,
} from "./queries/remessa-fifo-consumption.js";
export type { ReturnFifoReversalLine } from "./queries/remessa-fifo-consumption.js";
