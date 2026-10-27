/**
 * Erros de domínio do ciclo de vida da NF-e. Cada um carrega o próprio `status` HTTP
 * (400 por padrão); os controllers do ciclo de vida os traduzem com `statusErrors`.
 */

/** Cancelamento de NF-e (evento SEFAZ 110111). */
export class DocumentCancellationError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "DocumentCancellationError";
  }
}

/** Devolução de venda, insucesso de entrega e retorno físico. */
export class DocumentReturnError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "DocumentReturnError";
  }
}

/** Inutilização de faixa de numeração não usada (procInutNFe). */
export class NumberInutilizationError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "NumberInutilizationError";
  }
}

export const FISCAL_DOCUMENT_STATUS_ERRORS = [
  NumberInutilizationError,
  DocumentReturnError,
  DocumentCancellationError,
] as const;
