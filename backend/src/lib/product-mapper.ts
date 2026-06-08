import type { Product } from "../generated/prisma/client.js";

export type ProductDto = {
  id: string;
  tenantId: string;
  sku: string;
  ean?: string;
  nome: string;
  ncm: string;
  cest: string;
  exTipi?: string;
  origem: number;
  unidade: string;
  preco: number;
  precoCusto: number;
  estoque: number;
  taxRuleBaseId?: string;
};

export function mapProduct(row: Product): ProductDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    sku: row.sku,
    ean: row.ean ?? undefined,
    nome: row.nome,
    ncm: row.ncm,
    cest: row.cest,
    exTipi: row.exTipi ?? undefined,
    origem: row.origem,
    unidade: row.unidade,
    preco: Number(row.preco),
    precoCusto: Number(row.precoCusto),
    estoque: row.estoque,
    taxRuleBaseId: row.taxRuleBaseId ?? undefined,
  };
}

/** Valor para tag cEAN / cEANTrib na NF-e */
export function formatEanForXml(ean?: string | null): string {
  const digits = (ean ?? "").replace(/\D/g, "");
  if (digits.length === 8 || digits.length === 12 || digits.length === 13 || digits.length === 14) {
    return digits;
  }
  return "SEM GTIN";
}
