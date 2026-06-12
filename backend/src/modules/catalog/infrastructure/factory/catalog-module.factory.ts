import type { PrismaClient } from "../../../../generated/prisma/client.js";
import { BulkUpsertProductsUseCase } from "../../application/use-cases/bulk-upsert-products.use-case.js";
import { ImportProductsSpreadsheetUseCase } from "../../application/use-cases/import-products-spreadsheet.use-case.js";
import { CreateProductUseCase } from "../../application/use-cases/create-product.use-case.js";
import { DeleteProductUseCase } from "../../application/use-cases/delete-product.use-case.js";
import { GetProductByIdUseCase } from "../../application/use-cases/get-product-by-id.use-case.js";
import { ListProductsUseCase } from "../../application/use-cases/list-products.use-case.js";
import { UpdateProductUseCase } from "../../application/use-cases/update-product.use-case.js";
import { TaxRuleValidatorAdapter } from "../fiscal/tax-rule-validator.adapter.js";
import { PrismaProductRepository } from "../prisma/prisma-product.repository.js";

/** Composition root for the Catalog module. */
export function createCatalogModule(prisma: PrismaClient) {
  const productRepository = new PrismaProductRepository(prisma);
  const taxRuleValidator = new TaxRuleValidatorAdapter(prisma);
  const bulkUpsertProducts = new BulkUpsertProductsUseCase(productRepository, taxRuleValidator);

  return {
    listProducts: new ListProductsUseCase(productRepository),
    getProductById: new GetProductByIdUseCase(productRepository),
    createProduct: new CreateProductUseCase(productRepository, taxRuleValidator),
    updateProduct: new UpdateProductUseCase(productRepository, taxRuleValidator),
    deleteProduct: new DeleteProductUseCase(productRepository),
    bulkUpsertProducts,
    importProductsSpreadsheet: new ImportProductsSpreadsheetUseCase(bulkUpsertProducts),
    productRepository,
  };
}
