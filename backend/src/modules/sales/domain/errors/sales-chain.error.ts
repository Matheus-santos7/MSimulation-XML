export class SalesChainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SalesChainError";
  }
}
