/**
 * Bounded Context: Remessas (fiscal + logística FIFO).
 *
 * Camadas:
 * - domain/       entidades, VOs, domain services, ports
 * - application/  use cases (orquestração)
 * - infrastructure/ adapters Prisma + emissores fiscais legados
 */
export { TipoNota, CADEIA_AVANCO_MERCADORIA } from "./domain/value-objects/tipo-nota.js";
export {
  RemessaDomainError,
  CadeiaFiscalInvalidaError,
  SaldoFifoInsuficienteError,
} from "./domain/errors.js";
export type { NotaFiscal, NotaFiscalRascunho } from "./domain/entities/nota-fiscal.js";
export type { LinhaSaldoFifo, AlocacaoFifo } from "./domain/entities/linha-saldo-fifo.js";
export { ValidadorCadeiaFiscal } from "./domain/services/validador-cadeia-fiscal.js";
export { TransferidorSaldoFifo } from "./domain/services/transferidor-saldo-fifo.js";
export { EmitirRemessaInicialUseCase } from "./application/use-cases/emitir-remessa-inicial.js";
export { EmitirAvancoMercadoriaUseCase } from "./application/use-cases/emitir-avanco-mercadoria.js";
export { createRemessasModule } from "./infrastructure/factory/remessas-module.factory.js";
export { createRemessasAdapters } from "./infrastructure/factory/remessas-adapters.js";
export { mapAvancoMercadoriaParaApi } from "./presentation/avanco-api.mapper.js";

export {
  emitShipmentNfe,
  emitManualShipment,
  ShipmentError,
  type EmitShipmentOptions,
} from "./infrastructure/fiscal/physical-shipment/index.js";
export {
  prepareSymbolicShipmentFiscal,
  SymbolicShipmentFiscalError,
  type SymbolicShipmentFiscalPrepared,
} from "./infrastructure/fiscal/symbolic-shipment/index.js";
export {
  consumeRemessaFifoBalance,
  consumeRemessaFifoBalanceForSale,
  debitRemessaBalanceByCd,
  reverseRemessaFifoConsumptions,
  listRemessaBalanceByCd,
  refreshRemessaFifoItemsForNfes,
  getNetRemessaNfeBalance,
  prepareRemessaFifoForOperation,
  resolveAdvanceFiscalOrigin,
  resolveFifoOriginUnitId,
  realignRemessaFifoProductIdsBySku,
  buildRemessaFifoItemWhere,
  buildRemessaFifoItemsWhere,
  getAvailableRemessaBalance,
  previewRemessaPrincipalFifoParaVenda,
  loadRemessaForReturnDestination,
  SaldoRemessaInsuficienteError,
  type RemessaCdBalanceRow,
} from "./infrastructure/fifo/remessa-fifo.js";
export { emitShipmentCte } from "./infrastructure/fiscal/shipment-cte.service.js";

export {
  emitBranchTransfer,
  BranchTransferError,
  type BranchTransferItemInput,
} from "./infrastructure/fiscal/branch-transfer/index.js";
