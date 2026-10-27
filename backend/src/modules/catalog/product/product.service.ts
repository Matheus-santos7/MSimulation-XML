import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CatalogError } from "../errors/catalog.errors.js";
import { ProductRepository } from "./product.repository.js";
import type { Product } from "./product.types.js";

const PRODUCT_NOT_FOUND = "Produto não encontrado";

/** Consulta e exclusão de produtos da empresa do JWT. */
@Injectable()
export class ProductService {
  constructor(@Inject(ProductRepository) private readonly productRepository: ProductRepository) {}

  /** Produtos da empresa, por SKU. */
  list(tenantId: string): Promise<Product[]> {
    return this.productRepository.listByTenant(tenantId);
  }

  async get(id: string, tenantId: string): Promise<Product> {
    const product = await this.productRepository.findById(id, tenantId);
    if (!product) throw new NotFoundException(PRODUCT_NOT_FOUND);

    return product;
  }

  /**
   * Exclui o produto e os pedidos em rascunho dele. Pedido faturado bloqueia a exclusão
   * (o histórico de NF-e precisa ser preservado).
   * @throws {CatalogError.ProductConflict}
   */
  async delete(id: string, tenantId: string): Promise<void> {
    await this.get(id, tenantId);

    const invoicedCount = await this.productRepository.countInvoicedOrders(id);
    if (invoicedCount > 0) {
      const suffix = invoicedCount === 1 ? "pedido faturado" : "pedidos faturados";
      throw new CatalogError.ProductConflict(
        `Não é possível excluir: ${invoicedCount} ${suffix} vinculado(s) a este produto. O histórico de NF-e deve ser preservado.`,
      );
    }

    await this.productRepository.deleteProductAndDraftOrders(id);
  }

  /** @throws {NotFoundException} quando o PATCH não encontra o produto */
  orNotFound(product: Product | null): Product {
    if (!product) throw new NotFoundException(PRODUCT_NOT_FOUND);

    return product;
  }
}
