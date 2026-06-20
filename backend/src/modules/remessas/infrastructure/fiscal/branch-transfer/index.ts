/**
 * Branch Transfer Service (EN)
 *
 * Orchestrates branch transfer + automatic shipment to default warehouse:
 * 1. Matrix emits NFe TRANSFERENCIA_FILIAL (CFOP 5152/6152) to registered branch.
 * 2. Branch emits automatic physical shipment to default warehouse (inbound rule by origin branch × product).
 */
import type { DbClient } from "../../../../../lib/db/prisma-tx.js";
import { findProductInTenant } from "../../../../logistics/index.js";
import { gerarPedidoMl } from "../../../../fiscal-documents/domain/services/nfe-chave.js";
import { realignRemessaFifoProductIdsBySku } from "../../fifo/remessa-fifo.js";
import { resolveEmitenteFiscal } from "../../../../org/index.js";
import { createLogisticsModule } from "../../../../logistics/index.js";
import { emitShipmentWithItems } from "../physical-shipment/index.js";
import { BranchTransferError } from "./branch-transfer.errors.js";
import type { BranchTransferItemInput, BranchTransferLineInput } from "./branch-transfer.types.js";
import {
  loadBranch,
  resolveDefaultWarehouseForBranch,
  validateMatrixDistinctFromBranch,
  validateBranchTransferPrerequisites,
} from "./branch-transfer.validation.js";
import { emitBranchTransferNfeWithItems, buildEmitenteOverride } from "./branch-transfer-emission.js";

/**
 * Emit branch transfer operation.
 *
 * Creates transfer NFe from matrix to branch, then automatic shipment from branch to default warehouse.
 */
export async function emitBranchTransfer(
  db: DbClient,
  input: {
    tenantId: string;
    filialId: string;
    items: BranchTransferItemInput[];
  },
) {
  if (input.items.length === 0) {
    throw new BranchTransferError("Informe ao menos um produto na transferência");
  }

  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: input.tenantId } });
  const filial = await loadBranch(db, input.tenantId, input.filialId);

  const linhas: BranchTransferLineInput[] = [];
  for (const [index, item] of input.items.entries()) {
    const product = await findProductInTenant(db, input.tenantId, {
      productId: item.productId,
      sku: item.productSku,
    });
    if (!product) {
      const skuHint = item.productSku?.trim() ? ` (SKU ${item.productSku.trim()})` : "";
      throw new BranchTransferError(
        `Produto não encontrado (linha ${index + 1})${skuHint}. Confira o cadastro em Produtos.`,
      );
    }
    await realignRemessaFifoProductIdsBySku(db, input.tenantId, product.sku);
    if (item.quantidade < 1) {
      throw new BranchTransferError(`Quantidade inválida na linha ${index + 1}`);
    }
    linhas.push({ product, quantidade: item.quantidade });
  }

  const matrizEmitente = await resolveEmitenteFiscal(db, tenant, "matriz");
  await validateMatrixDistinctFromBranch(tenant, filial, matrizEmitente);
  const unidadeDestinoId = await resolveDefaultWarehouseForBranch(db, input.tenantId, filial);
  const logistics = createLogisticsModule();
  const cdDestino = await logistics.resolveShipmentDestination.execute(input.tenantId, unidadeDestinoId);
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
  const transferenciaRow = await emitBranchTransferNfeWithItems(
    db,
    tenant,
    filial,
    linhas,
    pedidoMl,
    matrizEmitente,
  );

  const remessaResult = await emitShipmentWithItems(db, tenant, linhas, {
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

export { BranchTransferError } from "./branch-transfer.errors.js";
export type { BranchTransferItemInput } from "./branch-transfer.types.js";

// Re-export ShipmentError from physical-shipment for convenience
export { ShipmentError } from "../physical-shipment/index.js";
