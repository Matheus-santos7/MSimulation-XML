/**
 * API pública do catálogo para outros módulos. Não reexporta o `CatalogModule` (o
 * `app.module.ts` importa pelo caminho dele).
 */
export { CatalogError } from "./errors/catalog.errors.js";
export { formatEanForXml, mapProduct, type ProductDto } from "./product/product.response.js";
export type { Product } from "./product/product.types.js";
export type { ProductWriteData } from "./product/types/product-write.types.js";
