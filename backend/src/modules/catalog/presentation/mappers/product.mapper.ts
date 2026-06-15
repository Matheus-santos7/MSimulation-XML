import type { Product as PrismaProduct } from "../../../../generated/prisma/client.js";
import type { Product } from "../../domain/entities/product.entity.js";
import { mapProductFromPrisma } from "../../infrastructure/prisma/product-prisma.mapper.js";

/** JSON response shape for the products API (mirrors the domain entity). */
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
