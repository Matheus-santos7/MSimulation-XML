import * as XLSX from "xlsx";
import type { ProductImportRawRow } from "../../modules/catalog/domain/entities/product-import-raw-row.entity.js";

/** Colunas da planilha padrão (CSV compatível com Excel BR — separador `;`). */
export const PRODUCT_SPREADSHEET_COLUMNS = [
  "sku",
  "ean",
  "nome",
  "ncm",
  "cest",
  "ex_tipi",
  "origem",
  "unidade",
  "preco",
  "preco_custo",
  "estoque",
  "tax_rule_base_id",
] as const;

export type ProductSpreadsheetColumn = (typeof PRODUCT_SPREADSHEET_COLUMNS)[number];

const HEADER_ALIASES: Record<string, ProductSpreadsheetColumn> = {
  sku: "sku",
  cprod: "sku",
  codigo: "sku",
  "código": "sku",
  ean: "ean",
  gtin: "ean",
  cean: "ean",
  nome: "nome",
  xprod: "nome",
  descricao: "nome",
  descrição: "nome",
  ncm: "ncm",
  cest: "cest",
  ex_tipi: "ex_tipi",
  extipi: "ex_tipi",
  origem: "origem",
  orig: "origem",
  unidade: "unidade",
  ucom: "unidade",
  utrib: "unidade",
  preco: "preco",
  preço: "preco",
  preco_venda: "preco",
  precovenda: "preco",
  vuncom: "preco",
  preco_custo: "preco_custo",
  precocusto: "preco_custo",
  custo: "preco_custo",
  vuncusto: "preco_custo",
  estoque: "estoque",
  stock: "estoque",
  quantidade: "estoque",
  tax_rule_base_id: "tax_rule_base_id",
  taxrulebaseid: "tax_rule_base_id",
  regra_fiscal: "tax_rule_base_id",
  regrafiscal: "tax_rule_base_id",
  regra_tributaria: "tax_rule_base_id",
};

export type ProductSpreadsheetParseResult = {
  rows: ProductImportRawRow[];
  errors: { line: number; message: string }[];
};

function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function detectDelimiter(line: string): ";" | "," {
  const semi = (line.match(/;/g) ?? []).length;
  const comma = (line.match(/,/g) ?? []).length;
  return semi >= comma ? ";" : ",";
}

/** Parser CSV simples com suporte a campos entre aspas. */
export function parseCsvLines(text: string, delimiter: ";" | ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      continue;
    }

    if (c === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (c === "\n" || (c === "\r" && next === "\n")) {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
      if (c === "\r") i++;
      continue;
    }

    if (c === "\r") continue;
    field += c;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  }

  return rows;
}

function cell(row: Record<ProductSpreadsheetColumn, string>, col: ProductSpreadsheetColumn): string {
  return row[col]?.trim() ?? "";
}

function rowToRawDto(line: number, row: Record<ProductSpreadsheetColumn, string>): ProductImportRawRow {
  return {
    line,
    sku: cell(row, "sku"),
    ean: cell(row, "ean") || undefined,
    nome: cell(row, "nome"),
    ncm: cell(row, "ncm"),
    cest: cell(row, "cest"),
    exTipi: cell(row, "ex_tipi") || undefined,
    origem: cell(row, "origem") || undefined,
    unidade: cell(row, "unidade") || undefined,
    preco: cell(row, "preco"),
    precoCusto: cell(row, "preco_custo"),
    estoque: cell(row, "estoque") || undefined,
    taxRuleBaseId: cell(row, "tax_rule_base_id") || undefined,
  };
}

function parseProductSpreadsheetMatrix(matrix: string[][]): ProductSpreadsheetParseResult {
  if (matrix.length === 0) {
    return { rows: [], errors: [{ line: 1, message: "Nenhuma linha encontrada" }] };
  }

  const headerRow = matrix[0]!;
  const colIndex = new Map<ProductSpreadsheetColumn, number>();
  for (let i = 0; i < headerRow.length; i++) {
    const key = normalizeHeader(headerRow[i] ?? "");
    const col = HEADER_ALIASES[key];
    if (col && !colIndex.has(col)) colIndex.set(col, i);
  }

  const missing = PRODUCT_SPREADSHEET_COLUMNS.filter(
    (c) => c !== "ean" && c !== "ex_tipi" && c !== "tax_rule_base_id" && !colIndex.has(c),
  );
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [{ line: 1, message: `Colunas obrigatórias ausentes: ${missing.join(", ")}` }],
    };
  }

  const rows: ProductImportRawRow[] = [];
  const errors: { line: number; message: string }[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const line = r + 1;
    const cells = matrix[r]!;
    if (cells.every((c) => !c.trim())) continue;

    const record = {} as Record<ProductSpreadsheetColumn, string>;
    for (const col of PRODUCT_SPREADSHEET_COLUMNS) {
      const idx = colIndex.get(col);
      record[col] = idx != null ? (cells[idx] ?? "") : "";
    }

    rows.push(rowToRawDto(line, record));
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push({ line: 2, message: "Nenhuma linha de dados na planilha" });
  }

  return { rows, errors };
}

export function parseProductSpreadsheetCsv(text: string): ProductSpreadsheetParseResult {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) {
    return { rows: [], errors: [{ line: 1, message: "Arquivo vazio" }] };
  }

  const firstLine = trimmed.split(/\r?\n/)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const matrix = parseCsvLines(trimmed, delimiter);
  return parseProductSpreadsheetMatrix(matrix);
}

export function parseProductSpreadsheetXlsx(buffer: Buffer): ProductSpreadsheetParseResult {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], errors: [{ line: 1, message: "Planilha vazia" }] };

  const matrix = XLSX.utils
    .sheet_to_json<(string | number | null)[]>(wb.Sheets[sheetName]!, {
      header: 1,
      raw: false,
      defval: "",
    })
    .map((row) => row.map((cell) => String(cell ?? "")));

  return parseProductSpreadsheetMatrix(matrix);
}
