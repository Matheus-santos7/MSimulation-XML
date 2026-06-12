/**
 * Linha bruta de importação de produtos (planilha CSV/XLSX).
 * Validação fiscal (NCM, CEST, etc.) ocorre no backend.
 */
export type ProductImportRawRow = {
  line: number;
  sku: string;
  ean?: string;
  nome: string;
  ncm: string;
  cest: string;
  exTipi?: string;
  origem?: string | number;
  unidade?: string;
  preco: string | number;
  precoCusto: string | number;
  estoque?: string | number;
  taxRuleBaseId?: string;
};
