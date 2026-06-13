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
  /** UUID da Ficha de Conteúdo de Importação — obrigatório para origem 3, 5 ou 8. */
  nfci?: string | number | null;
  origem?: string | number;
  unidade?: string;
  preco: string | number;
  precoCusto: string | number;
  estoque?: string | number;
  taxRuleBaseId?: string;
};
