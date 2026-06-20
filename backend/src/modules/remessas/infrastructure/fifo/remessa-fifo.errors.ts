export class SaldoRemessaInsuficienteError extends Error {
  constructor(
    public readonly productId: string,
    public readonly solicitado: number,
    public readonly disponivel: number,
  ) {
    super(
      `Saldo de remessa insuficiente para o produto. Solicitado: ${solicitado}, disponível: ${disponivel}. Emita nova remessa ou reduza a quantidade.`,
    );
    this.name = "SaldoRemessaInsuficienteError";
  }
}
