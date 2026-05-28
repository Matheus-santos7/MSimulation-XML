import type { NFeTipo } from "../generated/prisma/client.js";

type ProductPrices = {
  preco: { toString(): string } | number;
  precoCusto: { toString(): string } | number;
};

/** Preço unitário na NF-e: custo na remessa, venda na venda. */
export function productUnitPrice(product: ProductPrices, tipo: NFeTipo | "REMESSA" | "VENDA"): number {
  if (tipo === "REMESSA") return Number(product.precoCusto);
  return Number(product.preco);
}

export function lineTotal(unit: number, quantidade: number): number {
  return Math.round(unit * quantidade * 100) / 100;
}
