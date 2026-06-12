export class PasswordResetInvalidError extends Error {
  constructor(message = "Link inválido ou expirado. Solicite um novo e-mail.") {
    super(message);
    this.name = "PasswordResetInvalidError";
  }
}
