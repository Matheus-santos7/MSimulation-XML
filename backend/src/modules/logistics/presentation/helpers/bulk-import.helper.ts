import type { FastifyRequest } from "fastify";
import { parseMeliUnidadesXlsx } from "../../application/services/meli-unidade-planilha.js";
import { validateSpreadsheetBuffer } from "../../../../lib/shared/spreadsheet-upload.js";
import type { LogisticsUnitImportRow } from "../../domain/entities/logistics-unit-import-row.entity.js";
import { bulkImportJsonBody } from "../schemas/logistics.schemas.js";

function parseEnrichCepField(value: unknown): boolean {
  if (value == null || value === "") return true;
  const s = String(value).trim().toLowerCase();
  return s !== "false" && s !== "0" && s !== "no";
}

/**
 * Resolve payload do bulk import: multipart (XLSX) ou JSON.
 *
 * @returns Linhas parseadas, flag `enrichCep` e erros de parse parciais
 */
export async function resolveBulkImportPayload(req: FastifyRequest): Promise<
  | {
      ok: true;
      rows: LogisticsUnitImportRow[];
      enrichCep: boolean;
      parseErrors: { line: number; message: string }[];
    }
  | { ok: false; status: number; error: string; details?: unknown }
> {
  const contentType = req.headers["content-type"] ?? "";

  if (contentType.includes("multipart/form-data")) {
    let enrichCep = true;
    let fileBuffer: Buffer | null = null;
    let fileName = "";

    const parts = req.parts();
    for await (const part of parts) {
      if (part.type === "file") {
        if (part.fieldname !== "file") continue;
        fileName = part.filename ?? "";
        fileBuffer = await part.toBuffer();
        continue;
      }
      if (part.type === "field" && part.fieldname === "enrichCep") {
        enrichCep = parseEnrichCepField(part.value);
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return { ok: false, status: 400, error: "Envie o arquivo Excel no campo file" };
    }

    const lower = fileName.toLowerCase();
    if (lower && !lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      return { ok: false, status: 400, error: "Formato inválido. Envie um arquivo .xlsx ou .xls" };
    }

    const fileValidation = validateSpreadsheetBuffer(fileBuffer, {
      fileName,
      mimeType: undefined,
    });
    if (!fileValidation.ok) {
      return { ok: false, status: 400, error: fileValidation.error };
    }

    const parsed = parseMeliUnidadesXlsx(fileBuffer);
    if (parsed.rows.length === 0) {
      return {
        ok: false,
        status: 400,
        error: parsed.errors[0]?.message ?? "Nenhuma unidade válida na planilha",
        details: parsed.errors.length > 0 ? { parseErrors: parsed.errors } : undefined,
      };
    }

    return { ok: true, rows: parsed.rows, enrichCep, parseErrors: parsed.errors };
  }

  const body = req.body as { rows?: LogisticsUnitImportRow[]; enrichCep?: boolean };
  const parsed = bulkImportJsonBody.safeParse(body);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Payload inválido", details: parsed.error.flatten() };
  }

  return {
    ok: true,
    rows: parsed.data.rows,
    enrichCep: parsed.data.enrichCep !== false,
    parseErrors: [],
  };
}
