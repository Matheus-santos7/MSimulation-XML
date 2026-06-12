import type { FastifyRequest } from "fastify";
import { DEFAULT_SPREADSHEET_MAX_BYTES, validateSpreadsheetBuffer } from "../../../../lib/shared/spreadsheet-upload.js";

const MAX_PLANILHA_BYTES = DEFAULT_SPREADSHEET_MAX_BYTES;

/**
 * Extrai o buffer de planilha de produtos (CSV ou XLSX) de uma requisição multipart (`field: file`).
 */
export async function resolveProductSpreadsheetUpload(
  req: FastifyRequest,
): Promise<
  | { ok: true; buffer: Buffer; fileName: string }
  | { ok: false; status: number; error: string; details?: unknown }
> {
  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return { ok: false, status: 400, error: "Envie a planilha como multipart/form-data (campo file)" };
  }

  let fileBuffer: Buffer | null = null;
  let fileName = "";

  const parts = req.parts();
  for await (const part of parts) {
    if (part.type !== "file" || part.fieldname !== "file") continue;
    fileName = part.filename ?? "";
    fileBuffer = await part.toBuffer();
    break;
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    return { ok: false, status: 400, error: "Selecione um arquivo .xlsx ou .csv" };
  }

  if (fileBuffer.length > MAX_PLANILHA_BYTES) {
    return { ok: false, status: 400, error: "Arquivo excede o limite de 15 MB" };
  }

  const lower = fileName.toLowerCase();
  const isCsv = lower.endsWith(".csv");
  const isXlsx = lower.endsWith(".xlsx");
  if (!isCsv && !isXlsx) {
    return { ok: false, status: 400, error: "Formato inválido. Envie um arquivo .xlsx ou .csv" };
  }

  if (isXlsx) {
    const fileValidation = validateSpreadsheetBuffer(fileBuffer, { fileName, maxBytes: MAX_PLANILHA_BYTES });
    if (!fileValidation.ok) {
      return { ok: false, status: 400, error: fileValidation.error };
    }
  }

  return { ok: true, buffer: fileBuffer, fileName };
}
