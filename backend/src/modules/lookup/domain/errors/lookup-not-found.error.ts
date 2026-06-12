export class LookupNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LookupNotFoundError";
  }
}
