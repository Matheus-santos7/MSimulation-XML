export class UserForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserForbiddenError";
  }
}
