/**
 * Subconjunto do produto do catálogo necessário para montar {@link OrderLine}.
 */
export type ProductFiscalLine = {
  id: string;
  sku?: string | null;
  nome?: string | null;
  ncm: string;
  cest?: string | null;
  ean?: string | null;
  exTipi?: string | null;
  unidade?: string | null;
  origem?: number | null;
};
