/**
 * Leitura de .xlsx numa worker thread (P-8 da auditoria).
 *
 * O `XLSX.read` e o `sheet_to_json` são síncronos: uma planilha grande travava o event loop por
 * segundos e, com ele, todas as requisições da instância. Na worker o bloqueio fica isolado, com
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
  /** Repassado ao `XLSX.read`: corta as linhas lidas da aba. */
  sheetRows?: number;
  /** `false`: células formatadas como texto; `true`: valores crus (número, data serial). */
  raw: boolean;
  /** Recusa a aba cuja faixa declarada passa disso, antes de materializar a matriz. */
  maxColumns?: number;
};

export type ReadSheetResult =
  | { status: "ok"; matrix: SheetCell[][] }
  | { status: "no-sheet" }
  | { status: "too-many-columns" };

/**
 * Tempo máximo de leitura: a planilha real de regras (468 × ~400) lê em ~2 s; o teto de linhas
 * (5000 × 400), em 12-22 s.
 */
const READ_TIMEOUT_MS = 30_000;

/** Heap da worker: estourar encerra só a worker, não a API. */
const WORKER_MAX_HEAP_MB = 1024;

const xlsxPath = createRequire(import.meta.url).resolve("xlsx");

const WORKER_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
const XLSX = require(workerData.xlsxPath);
const { data, sheetAliases, sheetRows, raw, maxColumns } = workerData;
const wb = XLSX.read(Buffer.from(data), sheetRows ? { type: "buffer", sheetRows } : { type: "buffer" });
let name = wb.SheetNames[0];
if (sheetAliases) {
  const byName = new Map(wb.SheetNames.map((n) => [n.trim().toLowerCase(), n]));
  name = sheetAliases.map((a) => byName.get(a)).find((n) => n !== undefined);
}
const sheet = name === undefined ? undefined : wb.Sheets[name];
if (!sheet) {
  parentPort.postMessage({ status: "no-sheet" });
} else {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  if (maxColumns && range.e.c - range.s.c + 1 > maxColumns) {
    parentPort.postMessage({ status: "too-many-columns" });
  } else {
    parentPort.postMessage({
      status: "ok",
      matrix: XLSX.utils.sheet_to_json(sheet, { header: 1, raw, defval: "" }),
    });
  }
}
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
        xlsxPath,
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
