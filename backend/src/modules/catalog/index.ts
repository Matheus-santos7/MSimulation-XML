/**
 * Bounded Context: Catalog (products).
 *
 * Layers:
 * - domain/       entities, ports, domain errors
 * - application/  use cases (orchestration)
 * - infrastructure/ Prisma adapters + fiscal validation
 * - presentation/ HTTP controllers and mappers
 */
export type { Product } from "./domain/entities/product.entity.js";
export { ProductConflictError } from "./domain/errors/product-conflict.error.js";
export type { ProductRepository, ProductWriteData } from "./domain/ports/product.repository.js";
export type { CreateProductCommand } from "./application/dto/create-product.command.js";
export type { UpdateProductCommand } from "./application/dto/update-product.command.js";
export type {
  BulkUpsertProductsCommand,
  BulkUpsertProductsResult,
} from "./application/dto/bulk-upsert-products.command.js";
export { ListProductsUseCase } from "./application/use-cases/list-products.use-case.js";
export { GetProductByIdUseCase } from "./application/use-cases/get-product-by-id.use-case.js";
export { CreateProductUseCase } from "./application/use-cases/create-product.use-case.js";
export { UpdateProductUseCase } from "./application/use-cases/update-product.use-case.js";
export { DeleteProductUseCase } from "./application/use-cases/delete-product.use-case.js";
export { BulkUpsertProductsUseCase } from "./application/use-cases/bulk-upsert-products.use-case.js";
export { createCatalogModule } from "./infrastructure/factory/catalog-module.factory.js";
export { mapProductFromPrisma } from "./infrastructure/prisma/product-prisma.mapper.js";
export {
  formatEanForXml,
  mapProduct,
  type ProductDto,
} from "./presentation/mappers/product.mapper.js";
export { productController } from "./presentation/controllers/product.controller.js";
