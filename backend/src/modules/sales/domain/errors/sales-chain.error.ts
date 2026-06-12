export class SalesChainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SalesChainError";
  }
}

/** @deprecated Use SalesChainError */
export class VendaChainError extends SalesChainError {
  constructor(message: string) {
    super(message);
    this.name = "VendaChainError";
  }
}
