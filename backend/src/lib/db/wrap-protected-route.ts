import type { FastifyInstance, FastifyRequest, RouteOptions } from "fastify";
import { runWithDbContext, type DbRequestContext } from "./tenant-rls.js";

/**
 * Envolve o handler da rota em `runWithDbContext` para garantir RLS na mesma conexão física.
 */
export function wrapRouteWithDbContext(
  app: FastifyInstance,
  routeOptions: RouteOptions,
  getContext: (request: FastifyRequest) => DbRequestContext,
): void {
  const originalHandler = routeOptions.handler;
  if (typeof originalHandler !== "function") return;

  routeOptions.handler = async function routeHandlerWithDbContext(request, reply) {
    const ctx = getContext(request);

    return runWithDbContext(app.prisma, ctx, async (_tx) =>
      originalHandler.call(this, request, reply),
    );
  };
}

/** Rotas protegidas com JWT: RLS usa `userId` e `tenantId` do token. */
export function wrapProtectedRouteWithDbContext(
  app: FastifyInstance,
  routeOptions: RouteOptions,
): void {
  wrapRouteWithDbContext(app, routeOptions, (request) => ({
    userId: request.user.userId,
    tenantId: request.user.tenantId ?? undefined,
  }));
}
