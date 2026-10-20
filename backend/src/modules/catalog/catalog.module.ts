import { Module } from "@nestjs/common";
import { CATALOG } from "./catalog.tokens.js";
import { createCatalogModule } from "./infrastructure/factory/catalog-module.factory.js";
import { ProductController } from "./presentation/controllers/product.controller.js";

@Module({
  controllers: [ProductController],
  providers: [{ provide: CATALOG, useFactory: createCatalogModule }],
})
export class CatalogModule {}
