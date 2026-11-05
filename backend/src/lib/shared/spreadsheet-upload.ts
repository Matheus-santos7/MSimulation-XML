/** Validação de planilhas XLSX enviadas por usuários (magic bytes, MIME, tamanho). */

import { sumZipUncompressedSize } from "./zip-size.js";

const BYTES_PER_MB = 1024 * 1024;

export const DEFAULT_SPREADSHEET_MAX_BYTES = 15 * BYTES_PER_MB;

/**
 * Teto do conteúdo DESCOMPACTADO do .xlsx (soma das entradas do ZIP), para todos os importadores.
 * O `XLSX.read` é síncrono e bloqueia o event loop proporcionalmente ao XML descompactado; a
 * planilha real de regras (468 linhas × ~400 colunas) tem poucos MB. Ajuste aqui se uma planilha
 * legítima passar do teto.
 */
export const MAX_SPREADSHEET_UNCOMPRESSED_BYTES = 100 * BYTES_PER_MB;

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

export type SpreadsheetValidationResult = { ok: true } | { ok: false; error: string };

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
    return {
      ok: false,
      error: `Arquivo excede o limite de ${Math.round(maxBytes / (1024 * 1024))} MB`,
    };
  }

  const fileName = options.fileName?.toLowerCase() ?? "";
  // Só .xlsx: o .xls (BIFF) não tem o cabeçalho ZIP e seria recusado na checagem de conteúdo
  // logo abaixo. Para aceitar .xls de volta, é preciso também trocar a checagem de magic bytes.
  if (fileName && !fileName.endsWith(".xlsx")) {
    return { ok: false, error: "Formato inválido. Envie um arquivo .xlsx" };
  }

  const mimeType = options.mimeType?.trim().toLowerCase();
  if (mimeType && mimeType.length > 0 && !ALLOWED_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: "Tipo de arquivo não permitido" };
  }

  const invalidContent = {
    ok: false,
    error: "Conteúdo inválido. O arquivo não parece ser uma planilha Excel (.xlsx)",
  } as const;
  if (!hasXlsxMagicBytes(data)) return invalidContent;

  // Antes do XLSX.read: barra zip bomb sem descompactar. ZIP ilegível ou zip64 é recusado (falha fechada).
  const uncompressedBytes = sumZipUncompressedSize(data);
  if (uncompressedBytes === null) return invalidContent;

  if (uncompressedBytes > MAX_SPREADSHEET_UNCOMPRESSED_BYTES) {
    return {
      ok: false,
      error: `Planilha descompactada excede o limite de ${MAX_SPREADSHEET_UNCOMPRESSED_BYTES / BYTES_PER_MB} MB`,
    };
  }

  return { ok: true };
}
