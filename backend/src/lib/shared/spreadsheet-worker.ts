/**
 * Leitura de .xlsx numa worker thread (P-8 da auditoria).
 *
 * Ler o .xlsx (descompactar e interpretar o XML) é CPU pura: uma planilha grande travava o event
 * loop por segundos e, com ele, todas as requisições da instância. Na worker o bloqueio fica isolado, com
 * teto de memória e de tempo; a thread principal só recebe a matriz de células.
 *
 * O código da worker é JS em string (`eval`) para rodar igual em `tsx` (dev), Vitest e `dist/`:
 * um arquivo `.ts` de worker não carregaria fora do `tsx`.
 */
import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";

export type SheetCell = string | number | boolean | null;

export type ReadSheetOptions = {
  /** Abas aceitas, em ordem de preferência, minúsculas e sem espaço nas pontas. Sem valor: a 1ª. */
  sheetAliases?: readonly string[];
  /** Corta as linhas devolvidas da aba. */
  sheetRows?: number;
  /** `false`: toda célula como texto; `true`: número e booleano crus, data em ISO. */
  raw: boolean;
  /** Recusa a aba cuja faixa declarada passa disso, antes de materializar a matriz. */
  maxColumns?: number;
};

export type ReadSheetResult =
  | { status: "ok"; matrix: SheetCell[][] }
  | { status: "no-sheet" }
  | { status: "too-many-columns" };

/**
 * Tempo máximo de leitura (exceljs, medido): a planilha real de regras (468 × ~400) lê em ~2 s; o
 * teto de linhas (5000 × 400), em ~27 s. 60 s cobre o teto com folga para máquina carregada.
 */
const READ_TIMEOUT_MS = 60_000;

/** Heap da worker: estourar encerra só a worker, não a API. */
const WORKER_MAX_HEAP_MB = 1024;

const exceljsPath = createRequire(import.meta.url).resolve("exceljs");

// Célula → valor como o parser espera: mesclada fora da principal fica vazia (como no Excel), fórmula
// vale o resultado, rich text e hyperlink valem o texto. `raw: false` devolve texto.
const WORKER_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
const ExcelJS = require(workerData.exceljsPath);
const { data, sheetAliases, sheetRows, raw, maxColumns } = workerData;

function plain(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return value;
  if ("result" in value) return plain(value.result);
  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  if ("text" in value) return plain(value.text);
  if ("error" in value) return value.error;
  return "";
}

function cellValue(cell) {
  if (cell.type === ExcelJS.ValueType.Merge) return "";
  const value = plain(cell.value);
  if (raw || typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value);
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(data));
  let sheet = wb.worksheets[0];
  if (sheetAliases) {
    const byName = new Map(wb.worksheets.map((ws) => [ws.name.trim().toLowerCase(), ws]));
    sheet = sheetAliases.map((alias) => byName.get(alias)).find((ws) => ws !== undefined);
  }
  if (!sheet) return { status: "no-sheet" };

  const columns = sheet.columnCount;
  if (maxColumns && columns > maxColumns) return { status: "too-many-columns" };

  const rows = sheetRows ? Math.min(sheet.rowCount, sheetRows) : sheet.rowCount;
  const matrix = [];
  for (let r = 1; r <= rows; r++) {
    const out = new Array(columns).fill("");
    sheet.getRow(r).eachCell((cell, c) => {
      out[c - 1] = cellValue(cell);
    });
    matrix.push(out);
  }

  return { status: "ok", matrix };
}

main().then(
  (result) => parentPort.postMessage(result),
  (err) => setImmediate(() => { throw err; }),
);
`;

/** Arquivo que a worker não conseguiu ler (corrompido, grande demais, lento demais). */
export class SpreadsheetReadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SpreadsheetReadError";
  }
}

export function readSheetInWorker(
  data: Buffer | ArrayBuffer,
  options: ReadSheetOptions,
): Promise<ReadSheetResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: {
        exceljsPath,
        data,
        sheetAliases: options.sheetAliases,
        sheetRows: options.sheetRows,
        raw: options.raw,
        maxColumns: options.maxColumns,
      },
      resourceLimits: { maxOldGenerationSizeMb: WORKER_MAX_HEAP_MB },
    });
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(() => {
      settle(() => reject(new SpreadsheetReadError("A planilha demorou demais para ser lida")));
      void worker.terminate();
    }, READ_TIMEOUT_MS);

    worker.once("message", (result: ReadSheetResult) => settle(() => resolve(result)));
    worker.once("error", (cause) =>
      settle(() => reject(new SpreadsheetReadError("Não foi possível ler a planilha", { cause }))),
    );
    worker.once("exit", () =>
      settle(() => reject(new SpreadsheetReadError("Não foi possível ler a planilha"))),
    );
  });
}

/** Lê a aba; falha de leitura vira `{ status: "unreadable" }` com a mensagem para o usuário. */
export async function readSheetOrError(
  data: Buffer | ArrayBuffer,
  options: ReadSheetOptions,
): Promise<ReadSheetResult | { status: "unreadable"; message: string }> {
  try {
    return await readSheetInWorker(data, options);
  } catch (err) {
    if (err instanceof SpreadsheetReadError) return { status: "unreadable", message: err.message };
    throw err;
  }
}
