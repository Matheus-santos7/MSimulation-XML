import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { AuthenticatedUser } from "../../lib/auth/access-control.js";
import { tenantIdFromRequest, userIdFromRequest } from "../../lib/auth/request-context.js";

function requestOf(context: ExecutionContext): FastifyRequest {
  return context.switchToHttp().getRequest<FastifyRequest>();
}

/** Usuário autenticado pelo `JwtAuthGuard`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => requestOf(context).user,
);

/** `tenantId` confiável do usuário autenticado. */
export const TenantId = createParamDecorator((_data: unknown, context: ExecutionContext): string =>
  tenantIdFromRequest(requestOf(context)),
);

/** `userId` do usuário autenticado. */
export const UserId = createParamDecorator((_data: unknown, context: ExecutionContext): string =>
  userIdFromRequest(requestOf(context)),
);
