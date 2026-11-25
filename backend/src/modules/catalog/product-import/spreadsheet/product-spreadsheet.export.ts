import ExcelJS from "exceljs";
import type { Product } from "../../product/product.types.js";
import { PRODUCT_SPREADSHEET_COLUMNS } from "./product-spreadsheet.parser.js";

export const EX_TIPI_FIELD_HELP =
  "Código de exceção vinculado ao NCM para variação de IPI. Preencha apenas se o seu produto possuir essa regra específica. Caso contrário, deixe em branco.";

export const TAX_RULE_BASE_ID_FIELD_HELP =
  "Nome da família da regra (ex.: Chuveiro) ou o código (tax_rule_base_id). Não use o sufixo Contribuinte / Não contribuinte / Envio de estoque — a emissão escolhe a linha pela operação.";

const EXAMPLE_ROW: Record<(typeof PRODUCT_SPREADSHEET_COLUMNS)[number], string> = {
  sku: "300002137",
  ean: "7897180513306",
  nome: "Fogão 4 Bocas Atlas Atenas Glass",
  ncm: "73211100",
  cest: "",
  ex_tipi: "",
  origem: "0",
  nfci: "",
  unidade: "UNID",
  preco: "846,00",
  preco_custo: "520,00",
  estoque: "0",
  tax_rule_base_id: "Chuveiro",
};

function formatPrecoBr(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}

/** Uma célula por coluna de `PRODUCT_SPREADSHEET_COLUMNS`, na mesma ordem. */
function productToRow(p: Product): string[] {
  return [
    p.sku,
    p.ean ?? "",
    p.nome,
    p.ncm,
    p.cest ?? "",
    p.exTipi ?? "",
    String(p.origem),
    p.nfci ?? "",
    p.unidade,
    formatPrecoBr(p.preco),
    formatPrecoBr(p.precoCusto),
    String(p.estoque ?? 0),
    p.taxRuleBaseId ?? "",
  ];
}

/** Notas nos cabeçalhos que costumam gerar dúvida no preenchimento. */
const HEADER_NOTES: Partial<Record<(typeof PRODUCT_SPREADSHEET_COLUMNS)[number], string>> = {
  ex_tipi: EX_TIPI_FIELD_HELP,
  tax_rule_base_id: TAX_RULE_BASE_ID_FIELD_HELP,
};

function buildProductSpreadsheetMatrix(products: Product[], includeExample = false): string[][] {
  const matrix: string[][] = [PRODUCT_SPREADSHEET_COLUMNS.slice()];
  if (includeExample) {
    matrix.push(PRODUCT_SPREADSHEET_COLUMNS.map((column) => EXAMPLE_ROW[column]));
  }
  for (const product of products) {
    matrix.push(productToRow(product));
  }
  return matrix;
}

export async function buildProductSpreadsheetXlsx(
  products: Product[],
  includeExample = false,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Produtos");
  sheet.addRows(buildProductSpreadsheetMatrix(products, includeExample));
  PRODUCT_SPREADSHEET_COLUMNS.forEach((column, index) => {
    const note = HEADER_NOTES[column];
    if (note) sheet.getCell(1, index + 1).note = note;
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function buildProductSpreadsheetTemplateXlsx(): Promise<Buffer> {
  return buildProductSpreadsheetXlsx([], true);
}
