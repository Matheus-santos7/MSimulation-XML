import { HttpError } from "../../lib/http/http-error.js";

export type UploadFailure = { ok: false; status: number; error: string; details?: unknown };

/**
 * Converte a falha dos helpers de upload (`resolve*SpreadsheetUpload`) em `HttpError`
 * com o mesmo corpo de antes: `{ error }`, mais `details` quando houver.
 */
export function orUploadError<T extends { ok: true }>(result: T | UploadFailure): T {
  if (result.ok) return result;

  throw new HttpError(result.status, result.error, {
    error: result.error,
    ...(result.details ? { details: result.details } : {}),
  });
}
