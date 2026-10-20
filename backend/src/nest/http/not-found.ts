import { HttpError } from "../../lib/http/http-error.js";

const HTTP_NOT_FOUND = 404;

/** Devolve o valor ou lança 404 `{ error: message }` quando o use case não encontrou nada. */
export function orNotFound<T>(value: T | null | undefined | false, message: string): T {
  if (value === null || value === undefined || value === false) {
    throw new HttpError(HTTP_NOT_FOUND, message);
  }

  return value;
}
