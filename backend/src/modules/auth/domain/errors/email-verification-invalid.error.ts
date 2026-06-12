export class EmailVerificationInvalidError extends Error {
  constructor(message = "Link inválido ou expirado. Solicite um novo e-mail.") {
    super(message);
    this.name = "EmailVerificationInvalidError";
  }
}
