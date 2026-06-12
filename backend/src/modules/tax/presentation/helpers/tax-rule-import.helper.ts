import type { FastifyRequest } from "fastify";
import { validateSpreadsheetBuffer } from "../../../../lib/shared/spreadsheet-upload.js";

/**
 * Extrai o buffer XLSX de uma requisição multipart (`field: file`).
 */
export async function resolveTaxRuleSpreadsheetUpload(
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
    return { ok: false, status: 400, error: "Envie o arquivo Excel no campo file" };
  }

  const lower = fileName.toLowerCase();
  if (lower && !lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
    return { ok: false, status: 400, error: "Formato inválido. Envie um arquivo .xlsx ou .xls" };
  }

  const fileValidation = validateSpreadsheetBuffer(fileBuffer, { fileName });
  if (!fileValidation.ok) {
    return { ok: false, status: 400, error: fileValidation.error };
  }

  return { ok: true, buffer: fileBuffer, fileName };
}
