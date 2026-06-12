import type { Product as PrismaProduct } from "../../generated/prisma/client.js";
import type { Product } from "../../modules/catalog/domain/entities/product.entity.js";
import { mapProductFromPrisma } from "../../modules/catalog/infrastructure/prisma/product-prisma.mapper.js";

export type ProductDto = Product;

export function mapProduct(row: PrismaProduct): ProductDto {
  return mapProductFromPrisma(row);
}

/** Valor para tag cEAN / cEANTrib na NF-e */
export function formatEanForXml(ean?: string | null): string {
  const digits = (ean ?? "").replace(/\D/g, "");
  if (digits.length === 8 || digits.length === 12 || digits.length === 13 || digits.length === 14) {
    return digits;
  }
  return "SEM GTIN";
}
