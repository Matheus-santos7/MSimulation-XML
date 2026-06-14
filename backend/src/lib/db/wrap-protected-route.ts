import type { FastifyInstance, RouteOptions } from "fastify";
import { runWithDbContext } from "./tenant-rls.js";

/**
 * Envolve o handler da rota em `runWithDbContext` para garantir RLS na mesma conexão física.
 */
export function wrapProtectedRouteWithDbContext(
  app: FastifyInstance,
  routeOptions: RouteOptions,
): void {
  const originalHandler = routeOptions.handler;
  if (typeof originalHandler !== "function") return;

  routeOptions.handler = async function protectedRouteHandler(request, reply) {
    const ctx = {
      userId: request.user.userId,
      tenantId: request.user.tenantId ?? undefined,
    };

    return runWithDbContext(app.prisma, ctx, async (_tx) =>
      originalHandler.call(this, request, reply),
    );
  };
}
