/** Validação de planilhas XLSX enviadas por usuários (magic bytes, MIME, tamanho). */

export const DEFAULT_SPREADSHEET_MAX_BYTES = 15 * 1024 * 1024;

const XLSX_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;

const ALLOWED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
]);

export type SpreadsheetValidationOptions = {
  maxBytes?: number;
  fileName?: string;
  mimeType?: string;
};

export type SpreadsheetValidationResult =
  | { ok: true }
  | { ok: false; error: string };

function hasXlsxMagicBytes(data: Buffer | Uint8Array): boolean {
  if (data.length < XLSX_MAGIC.length) return false;
  return XLSX_MAGIC.every((byte, index) => data[index] === byte);
}

export function validateSpreadsheetBuffer(
  data: Buffer | Uint8Array,
  options: SpreadsheetValidationOptions = {},
): SpreadsheetValidationResult {
  const maxBytes = options.maxBytes ?? DEFAULT_SPREADSHEET_MAX_BYTES;

  if (data.length === 0) {
    return { ok: false, error: "Arquivo vazio" };
  }

  if (data.length > maxBytes) {
    return { ok: false, error: `Arquivo excede o limite de ${Math.round(maxBytes / (1024 * 1024))} MB` };
  }

  const fileName = options.fileName?.toLowerCase() ?? "";
  if (fileName && !fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
    return { ok: false, error: "Formato inválido. Envie um arquivo .xlsx ou .xls" };
  }

  const mimeType = options.mimeType?.trim().toLowerCase();
  if (mimeType && mimeType.length > 0 && !ALLOWED_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: "Tipo de arquivo não permitido" };
  }

  if (!hasXlsxMagicBytes(data)) {
    return { ok: false, error: "Conteúdo inválido. O arquivo não parece ser uma planilha Excel (.xlsx)" };
  }

  return { ok: true };
}
