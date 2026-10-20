/** Corpo de erro da API (`{ error }`, às vezes com campos extras). */
export type ErrorBody = { error: string } & Record<string, unknown>;

/** Status + corpo prontos para enviar ao cliente. */
export type ErrorResponse = { status: number; body: ErrorBody };

/**
 * Erro com status HTTP explícito, lançado na borda (guards, controllers Nest).
 * O filtro global responde `body` quando informado, senão `{ error: message }`.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: ErrorBody,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
