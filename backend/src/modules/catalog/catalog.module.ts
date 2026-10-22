import { Module } from "@nestjs/common";
import { TaxModule } from "../tax/tax.module.js";
import { ProductController } from "./product/product.controller.js";
import { ProductRepository } from "./product/product.repository.js";
import { ProductService } from "./product/product.service.js";
import { CreateProductUseCase } from "./product/use-cases/create-product.usecase.js";
import { UpdateProductUseCase } from "./product/use-cases/update-product.usecase.js";
import { ProductImportController } from "./product-import/product-import.controller.js";
import { BulkUpsertProductsUseCase } from "./product-import/use-cases/bulk-upsert-products.usecase.js";
import { ImportProductsSpreadsheetUseCase } from "./product-import/use-cases/import-products-spreadsheet.usecase.js";

/**
 * Catálogo de produtos.
 *
 * - `product/`: CRUD em `/products`.
 * - `product-import/`: planilha (modelo, exportação, importação) e upsert em massa por SKU.
 *
 * Importa o `TaxModule` para validar a regra fiscal vinculada ao produto.
 */
@Module({
  imports: [TaxModule],
  controllers: [ProductController, ProductImportController],
  providers: [
    ProductRepository,
    ProductService,
    CreateProductUseCase,
    UpdateProductUseCase,
    BulkUpsertProductsUseCase,
    ImportProductsSpreadsheetUseCase,
  ],
})
export class CatalogModule {}
