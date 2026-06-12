export class OrderLockedError extends Error {
  constructor() {
    super("Pedido já faturado — não pode ser alterado para preservar a numeração da NF-e");
    this.name = "OrderLockedError";
  }
}

/** @deprecated Use OrderLockedError */
export class PedidoLockedError extends OrderLockedError {
  constructor() {
    super();
    this.name = "PedidoLockedError";
  }
}
