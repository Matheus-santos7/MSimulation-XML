import type { Product as PrismaProduct } from "../../../../generated/prisma/client.js";
import type { Product } from "../../domain/entities/product.entity.js";

export function mapProductFromPrisma(row: PrismaProduct): Product {
  return {
    id: row.id,
    tenantId: row.tenantId,
    sku: row.sku,
    ean: row.ean ?? undefined,
    nome: row.nome,
    ncm: row.ncm,
    cest: row.cest,
    exTipi: row.exTipi ?? undefined,
    nfci: row.nfci ?? undefined,
    origem: row.origem,
    unidade: row.unidade,
    preco: Number(row.preco),
    precoCusto: Number(row.precoCusto),
    estoque: row.estoque,
    taxRuleBaseId: row.taxRuleBaseId ?? undefined,
  };
}
