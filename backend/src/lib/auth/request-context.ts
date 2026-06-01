import type { FastifyRequest } from "fastify";

/** `tenantId` confiável — somente do JWT validado pelo hook `authenticate`. */
export function tenantIdFromRequest(req: FastifyRequest): string {
  const tenantId = req.user.tenantId;
  if (!tenantId) {
    throw new TenantRequiredError();
  }
  return tenantId;
}

export class TenantRequiredError extends Error {
  constructor() {
    super("Cadastre uma empresa para continuar");
    this.name = "TenantRequiredError";
  }
}

export function userIdFromRequest(req: FastifyRequest): string {
  return req.user.userId;
}
