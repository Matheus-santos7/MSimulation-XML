export class EmitenteFiscalConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmitenteFiscalConfigError";
  }
}
