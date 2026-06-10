import type { NFeTipoValue } from "./nfe-tipo.js";
import { NFeTipo } from "./nfe-tipo.js";

export type ProductPrices = {
  preco: { toString(): string } | number;
  precoCusto: { toString(): string } | number;
};

function usesPrecoCusto(tipo: NFeTipoValue | string): boolean {
  return (
    tipo === NFeTipo.REMESSA ||
    tipo === NFeTipo.REMESSA_SIMBOLICA ||
    tipo === NFeTipo.RETORNO_SIMBOLICO
  );
}

/** Preço unitário na NF-e: custo em remessa/retorno, venda na venda. */
export function productUnitPrice(product: ProductPrices, tipo: NFeTipoValue): number {
  if (usesPrecoCusto(tipo)) return Number(product.precoCusto);
  return Number(product.preco);
}

export function lineTotal(unit: number, quantidade: number): number {
  return Math.round(unit * quantidade * 100) / 100;
}

export type ProductPricesDto = {
  preco: number;
  precoCusto: number;
};

/** Preço unitário no XML/UI quando só há DTO de produto + NF-e. */
export function productUnitPriceForNfe(
  product: ProductPricesDto | undefined,
  nfe: { tipo: NFeTipoValue | string; valor: number; quantidade: number },
): number {
  const q = nfe.quantidade > 0 ? nfe.quantidade : 1;
  if (!product) return nfe.valor / q;
  if (usesPrecoCusto(nfe.tipo)) return product.precoCusto;
  return product.preco;
}
