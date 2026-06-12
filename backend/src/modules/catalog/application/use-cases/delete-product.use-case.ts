import { ProductConflictError } from "../../domain/errors/product-conflict.error.js";
import type { ProductRepository } from "../../domain/ports/product.repository.js";

/**
 * Remove produto do catálogo e pedidos em rascunho associados.
 *
 * Bloqueia exclusão se existir pedido `FATURADO` vinculado (preservação de histórico NF-e).
 *
 * @param id - UUID do produto
 * @param tenantId - Tenant emitente
 * @returns `true` se removido, `false` se produto não encontrado
 * @throws {ProductConflictError} Pedidos faturados ou FK impedem exclusão
 */
export class DeleteProductUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(id: string, tenantId: string): Promise<boolean> {
    const existing = await this.productRepository.findById(id, tenantId);
    if (!existing) return false;

    const invoicedCount = await this.productRepository.countInvoicedOrders(id);
    if (invoicedCount > 0) {
      const suffix = invoicedCount === 1 ? "pedido faturado" : "pedidos faturados";
      throw new ProductConflictError(
        `Não é possível excluir: ${invoicedCount} ${suffix} vinculado(s) a este produto. O histórico de NF-e deve ser preservado.`,
      );
    }

    await this.productRepository.deleteProductAndDraftOrders(id);
    return true;
  }
}
