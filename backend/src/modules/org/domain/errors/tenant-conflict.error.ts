export class TenantConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantConflictError";
  }
}
