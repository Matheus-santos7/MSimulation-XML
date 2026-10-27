import { Inject, Injectable } from "@nestjs/common";
import { getBillableMarketplaceProfile } from "@msimulation-xml/fiscal-core";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import { gerarPedidoMl } from "../../../fiscal-documents/index.js";
import {
  findProductInTenant,
  LogisticsUnitService,
  ProductMovementService,
} from "../../../logistics/index.js";
import { resolveEmitenteFiscal } from "../../../org/index.js";
import { ShipmentEmitter } from "../../shipment/shipment.emitter.js";
import { StockFifoRepository } from "../../stock-fifo/stock-fifo.repository.js";
import {
  buildEmitenteOverride,
  emitBranchTransferNfeWithItems,
} from "../branch-transfer.emitter.js";
import { BranchTransferError } from "../branch-transfer.errors.js";
import type { BranchTransferCommand, BranchTransferLineInput } from "../branch-transfer.types.js";
import {
  loadBranch,
  resolveDefaultWarehouseForBranch,
  validateBranchTransferPrerequisites,
  validateMatrixDistinctFromBranch,
} from "../rules/branch-transfer.validation.js";

/**
 * Transferência matriz → filial seguida da remessa automática da filial para o CD padrão:
 * 1. Matriz emite NF-e TRANSFERENCIA_FILIAL (CFOP 5152/6152) para a filial.
 * 2. Filial emite a remessa física ao CD (regra de entrada filial × produto).
 *
 * As duas notas saem no marketplace do CD. O perfil é checado antes da primeira nota, para
 * a transferência não ficar emitida sem a remessa.
 */
@Injectable()
export class BranchTransferEmitUseCase {
  constructor(
    @Inject(LogisticsUnitService) private readonly units: LogisticsUnitService,
    @Inject(ProductMovementService) private readonly movements: ProductMovementService,
    @Inject(StockFifoRepository) private readonly stockFifo: StockFifoRepository,
    @Inject(ShipmentEmitter) private readonly shipmentEmitter: ShipmentEmitter,
  ) {}

  async execute(command: BranchTransferCommand) {
    if (command.items.length === 0) {
      throw new BranchTransferError("Informe ao menos um produto na transferência");
    }

    const db = getDbClient();
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: command.tenantId } });
    const filial = await loadBranch(db, command.tenantId, command.filialId);
    const linhas = await this.loadLines(command);

    const matrizEmitente = await resolveEmitenteFiscal(db, tenant, "matriz");
    await validateMatrixDistinctFromBranch(tenant, filial, matrizEmitente);
    const unidadeDestinoId = await resolveDefaultWarehouseForBranch(
      db,
      this.units,
      command.tenantId,
      filial,
    );
    const cdDestino = await this.units.resolveShipmentDestination(
      command.tenantId,
      unidadeDestinoId,
    );
    getBillableMarketplaceProfile(cdDestino.marketplace);
    await validateBranchTransferPrerequisites(
      db,
      tenant,
      filial,
      linhas,
      unidadeDestinoId,
      cdDestino.uf,
      matrizEmitente.uf,
    );

    const pedidoMl = gerarPedidoMl();
    const transferenciaRow = await emitBranchTransferNfeWithItems(db, this.movements, {
      tenant,
      filial,
      linhas,
      pedidoMl,
      matrizEmitente,
      marketplace: cdDestino.marketplace,
    });

    const remessaResult = await this.shipmentEmitter.emit(db, tenant, linhas, {
      unidadeDestinoId,
      pedidoMl,
      emitenteOverride: buildEmitenteOverride(filial),
      observacaoAvanco: `Remessa automática pós-transferência filial ${filial.cnpj}`,
      nfeReferenciaId: transferenciaRow.id,
    });

    return {
      transferencia: transferenciaRow.nfe,
      remessa: remessaResult.nfe,
      cte: remessaResult.cte,
      totalItens: linhas.length,
      filial: {
        id: filial.id,
        cnpj: filial.cnpj,
        uf: filial.uf,
        serieRemessa: filial.serieRemessa,
      },
      unidadeDestinoId,
    };
  }

  private async loadLines(command: BranchTransferCommand): Promise<BranchTransferLineInput[]> {
    const db = getDbClient();
    const linhas: BranchTransferLineInput[] = [];
    for (const [index, item] of command.items.entries()) {
      const product = await findProductInTenant(db, command.tenantId, {
        productId: item.productId,
        sku: item.productSku,
      });
      if (!product) {
        const skuHint = item.productSku?.trim() ? ` (SKU ${item.productSku.trim()})` : "";
        throw new BranchTransferError(
          `Produto não encontrado (linha ${index + 1})${skuHint}. Confira o cadastro em Produtos.`,
        );
      }
      await this.stockFifo.realignProductIdBySku(command.tenantId, product.sku);
      if (item.quantidade < 1) {
        throw new BranchTransferError(`Quantidade inválida na linha ${index + 1}`);
      }
      linhas.push({ product, quantidade: item.quantidade });
    }

    return linhas;
  }
}
