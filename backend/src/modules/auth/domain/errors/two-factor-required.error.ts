export class TwoFactorRequiredError extends Error {
  constructor(message = "Código de autenticação inválido") {
    super(message);
    this.name = "TwoFactorRequiredError";
  }
}
