export class LookupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LookupValidationError";
  }
}
