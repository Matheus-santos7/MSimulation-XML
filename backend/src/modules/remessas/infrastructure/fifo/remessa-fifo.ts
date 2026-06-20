/**
 * Controle de saldo de remessas físicas (FIFO) por linha de NF-e (`nfe_itens`).
 *
 * Barrel público — imports externos devem continuar usando `./remessa-fifo.js`.
 */
export { SaldoRemessaInsuficienteError } from "./remessa-fifo.errors.js";
export type { RemessaCdBalanceRow, PreviewRemessaFifoVenda } from "./remessa-fifo.types.js";
export {
  buildRemessaFifoItemWhere,
  buildRemessaFifoItemsWhere,
  collectRemessaSaldoProductIds,
  realignRemessaFifoProductIdsBySku,
} from "./remessa-fifo-product-ids.js";
export { prepareRemessaFifoForOperation } from "./remessa-fifo-item-sync.js";
export {
  getAvailableRemessaBalance,
  refreshRemessaFifoItemsForNfes,
  getNetRemessaNfeBalance,
  listRemessaBalanceByCd,
} from "./remessa-fifo-balance-query.js";
export {
  resolveAdvanceFiscalOrigin,
  resolveFifoOriginUnitId,
} from "./remessa-fifo-origin-resolver.js";
export {
  consumeRemessaFifoBalance,
  previewRemessaPrincipalFifoParaVenda,
  loadRemessaForReturnDestination,
  consumeRemessaFifoBalanceForSale,
  debitRemessaBalanceByCd,
  reverseRemessaFifoConsumptions,
} from "./remessa-fifo-consumption.js";
