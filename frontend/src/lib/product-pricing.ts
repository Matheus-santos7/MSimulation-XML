import type { NFeDto, ProductDto } from "@/lib/fiscal-types";

/** Preço unitário no XML: custo na remessa, venda na venda. */
export function productUnitPriceForNfe(
  product: ProductDto | undefined,
  nfe: Pick<NFeDto, "tipo" | "valor" | "quantidade">,
): number {
  const q = nfe.quantidade > 0 ? nfe.quantidade : 1;
  if (!product) return nfe.valor / q;
  if (nfe.tipo === "REMESSA") return product.precoCusto;
  return product.preco;
}
