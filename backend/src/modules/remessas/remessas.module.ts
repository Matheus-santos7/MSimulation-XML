import { Module } from "@nestjs/common";
import { LogisticsModule } from "../logistics/logistics.module.js";
import { BranchTransferController } from "./branch-transfer/branch-transfer.controller.js";
import { BranchTransferEmitUseCase } from "./branch-transfer/use-cases/branch-transfer-emit.usecase.js";
import { FiscalChainNoteRepository } from "./fiscal-chain/fiscal-chain-note.repository.js";
import { ShipmentController } from "./shipment/shipment.controller.js";
import { ShipmentEmitter } from "./shipment/shipment.emitter.js";
import { ShipmentEmitUseCase } from "./shipment/use-cases/shipment-emit.usecase.js";
import { StockFifoController } from "./stock-fifo/stock-fifo.controller.js";
import { StockFifoRepository } from "./stock-fifo/stock-fifo.repository.js";
import { WarehouseAdvanceEmitUseCase } from "./warehouse-advance/use-cases/warehouse-advance-emit.usecase.js";
import { WarehouseAdvanceController } from "./warehouse-advance/warehouse-advance.controller.js";
import { WarehouseAdvanceFiscalEmitter } from "./warehouse-advance/warehouse-advance-fiscal.emitter.js";

/**
 * Remessas: notas que movem estoque até o CD do marketplace e o saldo FIFO que elas criam.
 *
 * | Pasta | Rotas |
 * |-------|-------|
 * | `shipment/` | POST /movimentacoes/remessa (remessa física seller → CD) |
 * | `branch-transfer/` | POST /movimentacoes/transferencia-filial (matriz → filial → CD) |
 * | `warehouse-advance/` | POST /movimentacoes/avanco-cd (retorno + remessa simbólicos) |
 * | `stock-fifo/` | GET /movimentacoes/saldo-cd, POST /movimentacoes/remessa/realign-fifo |
 * | `symbolic-shipment/` | sem rota: remessa simbólica usada pelo avanço e pela devolução |
 * | `fiscal-chain/` | sem rota: regras de amarração entre notas, gravação e CT-e |
 *
 * O marketplace de cada nota é o do CD de destino; dele saem o perfil fiscal
 * (`getBillableMarketplaceProfile`) e a configuração efetiva do faturador.
 */
@Module({
  imports: [LogisticsModule],
  controllers: [
    ShipmentController,
    BranchTransferController,
    WarehouseAdvanceController,
    StockFifoController,
  ],
  providers: [
    StockFifoRepository,
    FiscalChainNoteRepository,
    ShipmentEmitter,
    ShipmentEmitUseCase,
    BranchTransferEmitUseCase,
    WarehouseAdvanceFiscalEmitter,
    WarehouseAdvanceEmitUseCase,
  ],
})
export class RemessasModule {}
