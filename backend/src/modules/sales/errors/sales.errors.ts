/** Dados do pedido ou do checkout inválidos (produto de outra empresa, id fora do formato). */
export class CheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutError";
  }
}

/** Pedido faturado não pode ser alterado: a numeração da NF-e já foi usada. */
export class OrderLockedError extends Error {
  constructor() {
    super("Pedido já faturado — não pode ser alterado para preservar a numeração da NF-e");
    this.name = "OrderLockedError";
  }
}

/** Regra da cadeia de venda violada (produto sem regra fiscal, sem custo, CFOP inconsistente). */
export class SalesChainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SalesChainError";
  }
}
