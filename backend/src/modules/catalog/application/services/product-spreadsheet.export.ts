import * as XLSX from "xlsx";
import type { Product } from "../../domain/entities/product.entity.js";
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

function escapeCsv(value: string): string {
  if (/[;"\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatPrecoBr(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}

function productToRow(p: Product): string[] {
  return [
    p.sku,
    p.ean ?? "",
    p.nome,
    p.ncm,
    p.cest ?? "",
    p.exTipi ?? "",
    String(p.origem),
    p.unidade,
    formatPrecoBr(p.preco),
    formatPrecoBr(p.precoCusto),
    String(p.estoque ?? 0),
    p.taxRuleBaseId ?? "",
  ];
}

export function buildProductSpreadsheetCsv(products: Product[], includeExample = false): string {
  const header = PRODUCT_SPREADSHEET_COLUMNS.join(";");
  const lines = [header];
  if (includeExample) {
    lines.push(PRODUCT_SPREADSHEET_COLUMNS.map((c) => escapeCsv(EXAMPLE_ROW[c])).join(";"));
  }
  for (const p of products) {
    lines.push(productToRow(p).map(escapeCsv).join(";"));
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

function attachHeaderComment(
  ws: XLSX.WorkSheet,
  column: (typeof PRODUCT_SPREADSHEET_COLUMNS)[number],
  text: string,
): void {
  const colIndex = PRODUCT_SPREADSHEET_COLUMNS.indexOf(column);
  if (colIndex < 0) return;

  const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIndex });
  const cell = ws[cellRef];
  if (!cell) return;

  cell.c = [{ a: "MS Edit", t: text }];
}

function attachSpreadsheetHeaderComments(ws: XLSX.WorkSheet): void {
  attachHeaderComment(ws, "ex_tipi", EX_TIPI_FIELD_HELP);
  attachHeaderComment(ws, "tax_rule_base_id", TAX_RULE_BASE_ID_FIELD_HELP);
}

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

export function buildProductSpreadsheetXlsx(products: Product[], includeExample = false): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(buildProductSpreadsheetMatrix(products, includeExample));
  attachSpreadsheetHeaderComments(ws);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Produtos");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function buildProductSpreadsheetTemplateXlsx(): Buffer {
  return buildProductSpreadsheetXlsx([], true);
}
