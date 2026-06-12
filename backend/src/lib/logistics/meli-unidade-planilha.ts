import * as XLSX from "xlsx";
import { normalizeIdCadIntTran } from "./meli-unidade.js";
import type { LogisticsUnitImportRow } from "../../modules/logistics/index.js";

export type MeliUnidadePlanilhaParseResult = {
  rows: LogisticsUnitImportRow[];
  errors: { line: number; message: string }[];
};

const HEADER_MAP: Record<string, keyof LogisticsUnitImportRow | "_skip"> = {
  unidade: "unidade",
  cnpj: "cnpj",
  "inscrição estadual": "inscricaoEstadual",
  "inscricao estadual": "inscricaoEstadual",
  logradouro: "logradouro",
  número: "numero",
  numero: "numero",
  cidade: "cidade",
  uf: "uf",
  cep: "cep",
  "id cad int tran": "idCadIntTran",
  idcadinttran: "idCadIntTran",
  "id cadastro intermediador": "idCadIntTran",
  "id intermediador": "idCadIntTran",
  "id intermediador ml": "idCadIntTran",
};

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function parseMeliUnidadesXlsx(buffer: Buffer | ArrayBuffer): MeliUnidadePlanilhaParseResult {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], errors: [{ line: 1, message: "Planilha vazia" }] };

  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(wb.Sheets[sheetName]!, {
    header: 1,
    raw: true,
    defval: "",
  });
  if (matrix.length < 2) {
    return { rows: [], errors: [{ line: 1, message: "Planilha sem linhas de dados" }] };
  }

  const headers = matrix[0]!.map((c) => normalizeHeader(String(c ?? "")));
  const colIndex: Partial<Record<keyof LogisticsUnitImportRow, number>> = {};
  headers.forEach((h, i) => {
    const key = HEADER_MAP[h];
    if (key && key !== "_skip") colIndex[key] = i;
  });

  if (colIndex.unidade === undefined || colIndex.cnpj === undefined) {
    return {
      rows: [],
      errors: [{ line: 1, message: "Colunas obrigatórias: Unidade, CNPJ" }],
    };
  }

  const errors: { line: number; message: string }[] = [];
  const rows: LogisticsUnitImportRow[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const line = i + 1;
    const row = matrix[i]!;
    const cell = (key: keyof LogisticsUnitImportRow) => {
      const idx = colIndex[key];
      if (idx === undefined) return "";
      const v = row[idx];
      return v == null ? "" : v;
    };

    const unidade = String(cell("unidade")).trim();
    const cnpj = cell("cnpj");
    if (!unidade && !cnpj) continue;
    if (!unidade) {
      errors.push({ line, message: "Unidade vazia" });
      continue;
    }
    if (cnpj === "" || cnpj == null) {
      errors.push({ line, message: "CNPJ vazio" });
      continue;
    }

    rows.push({
      unidade,
      cnpj: typeof cnpj === "number" ? cnpj : String(cnpj),
      inscricaoEstadual: String(cell("inscricaoEstadual") || "").trim() || undefined,
      ...(colIndex.idCadIntTran !== undefined
        ? { idCadIntTran: normalizeIdCadIntTran(cell("idCadIntTran")) }
        : {}),
      logradouro: String(cell("logradouro") || "").trim(),
      numero: String(cell("numero") || "SN").trim() || "SN",
      cidade: String(cell("cidade") || "").trim(),
      uf: String(cell("uf") || "")
        .trim()
        .toUpperCase()
        .slice(0, 2),
      cep: typeof cell("cep") === "number" ? cell("cep") : String(cell("cep") || ""),
    });
  }

  return { rows, errors };
}
