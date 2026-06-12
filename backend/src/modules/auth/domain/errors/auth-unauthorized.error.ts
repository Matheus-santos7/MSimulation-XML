export const AUTH_GENERIC_LOGIN_ERROR = "E-mail ou senha inválidos";

export class AuthUnauthorizedError extends Error {
  constructor(message = AUTH_GENERIC_LOGIN_ERROR) {
    super(message);
    this.name = "AuthUnauthorizedError";
  }
}
