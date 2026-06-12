export class AuthStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthStateError";
  }
}
