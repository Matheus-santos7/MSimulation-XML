import { Inject, Injectable } from "@nestjs/common";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import { findProductInTenant, LogisticsUnitService } from "../../../logistics/index.js";
import { RemessaDomainError } from "../../errors/remessas.errors.js";
import { criarRemessaInicial } from "../../fiscal-chain/fiscal-chain.types.js";
import { ValidadorCadeiaFiscal } from "../../fiscal-chain/rules/validador-cadeia-fiscal.js";
import { StockFifoRepository } from "../../stock-fifo/stock-fifo.repository.js";
import { ShipmentEmitter } from "../shipment.emitter.js";
import { ShipmentError } from "../shipment.errors.js";
import type { ShipmentEmitCommand, ShipmentEmitResult } from "../shipment.types.js";
import type { PhysicalShipmentLineInput } from "../types/shipment-emission.types.js";

/** Remessa física inicial: seller → CD (primeira nota da cadeia, origina o saldo FIFO). */
@Injectable()
export class ShipmentEmitUseCase {
  private readonly validador = new ValidadorCadeiaFiscal();

  constructor(
    @Inject(LogisticsUnitService) private readonly units: LogisticsUnitService,
    @Inject(StockFifoRepository) private readonly stockFifo: StockFifoRepository,
    @Inject(ShipmentEmitter) private readonly emitter: ShipmentEmitter,
  ) {}

  async execute(command: ShipmentEmitCommand): Promise<ShipmentEmitResult> {
    if (command.items.length === 0) {
      throw new RemessaDomainError("Informe ao menos um produto na remessa inicial");
    }

    const unidadeDestinoId =
      command.unidadeDestinoId ??
      (await this.units.resolveShipmentDestination(command.tenantId)).unitId;

    for (const item of command.items) {
      this.validador.validarRascunho(
        criarRemessaInicial({
          tenantId: command.tenantId,
          productId: item.productId,
          serie: 0,
          quantidade: item.quantidade,
          unidadeOrigemId: null,
          unidadeDestinoId,
        }),
      );

      if (item.productSku?.trim()) {
        await this.stockFifo.realignProductIdBySku(command.tenantId, item.productSku);
      }
    }

    const db = getDbClient();
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: command.tenantId } });
    const linhas = await this.loadLines(command);

    return this.emitter.emit(db, tenant, linhas, { unidadeDestinoId });
  }

  private async loadLines(command: ShipmentEmitCommand): Promise<PhysicalShipmentLineInput[]> {
    const db = getDbClient();
    const linhas: PhysicalShipmentLineInput[] = [];
    for (const [index, item] of command.items.entries()) {
      const product = await findProductInTenant(db, command.tenantId, {
        productId: item.productId,
        sku: item.productSku,
      });
      if (!product) {
        const skuHint = item.productSku?.trim() ? ` (SKU ${item.productSku.trim()})` : "";
        throw new ShipmentError(
          `Produto não encontrado (linha ${index + 1})${skuHint}. Confira o cadastro em Produtos.`,
        );
      }
      await this.stockFifo.realignProductIdBySku(command.tenantId, product.sku);
      if (item.quantidade < 1) {
        throw new ShipmentError(`Quantidade inválida na linha ${index + 1}`);
      }
      linhas.push({ product, quantidade: item.quantidade });
    }

    return linhas;
  }
}
