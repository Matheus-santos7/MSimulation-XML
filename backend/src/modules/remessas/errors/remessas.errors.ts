export class RemessaDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemessaDomainError";
  }
}

export class CadeiaFiscalInvalidaError extends RemessaDomainError {
  constructor(
    public readonly tipoFilha: string,
    public readonly tipoPai: string | null,
  ) {
    super(
      tipoPai
        ? `Nota ${tipoFilha} não pode referenciar nota ${tipoPai}`
        : `Nota ${tipoFilha} exige referência a nota anterior`,
    );
    this.name = "CadeiaFiscalInvalidaError";
  }
}

export class SaldoFifoInsuficienteError extends RemessaDomainError {
  constructor(
    public readonly solicitado: number,
    public readonly disponivel: number,
    public readonly unidadeDestinoId?: string,
  ) {
    super(
      unidadeDestinoId
        ? `Saldo FIFO insuficiente no CD. Solicitado: ${solicitado}, disponível: ${disponivel}.`
        : `Saldo FIFO insuficiente. Solicitado: ${solicitado}, disponível: ${disponivel}.`,
    );
    this.name = "SaldoFifoInsuficienteError";
  }
}
