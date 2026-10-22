/**
 * API pública do remessas para outros módulos (vendas, documentos fiscais, logística).
 *
 * Só expõe funções, tipos e erros: os use cases e controllers ficam dentro do
 * `RemessasModule`, e o logística (que o remessas importa) também lê o saldo FIFO daqui.
 */
export {
  CadeiaFiscalInvalidaError,
  RemessaDomainError,
  SaldoFifoInsuficienteError,
} from "./errors/remessas.errors.js";
export type { NotaFiscal, NotaFiscalRascunho } from "./fiscal-chain/fiscal-chain.types.js";
export { CADEIA_AVANCO_MERCADORIA, TipoNota } from "./fiscal-chain/rules/tipo-nota.js";
export { ShipmentError } from "./shipment/shipment.errors.js";
export type { AlocacaoFifo } from "./stock-fifo/stock-fifo.types.js";
export * from "./stock-fifo/remessa-fifo.js";
export type { RemessaFifoTx } from "./stock-fifo/types/remessa-fifo.types.js";
export {
  destIeRetornoFromRemessa,
  destinoRetornoFromRemessa,
  resolveRetornoSimbolicoCfop,
  RETORNO_SIMBOLICO_NAT_OP,
  type CamposDestinoRetorno,
} from "./symbolic-shipment/rules/retorno-simbolico-dest.js";
export { prepareSymbolicShipmentFiscal } from "./symbolic-shipment/symbolic-shipment-fiscal.js";
export { SymbolicShipmentFiscalError } from "./symbolic-shipment/symbolic-shipment.errors.js";
export type {
  SymbolicShipmentAfterReturnInput,
  SymbolicShipmentFiscalPrepared,
  SymbolicShipmentLine,
  SymbolicShipmentProduct,
} from "./symbolic-shipment/symbolic-shipment.types.js";
