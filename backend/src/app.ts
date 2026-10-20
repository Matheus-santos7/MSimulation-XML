/**
 * Monta a instância Fastify sem escutar porta (boot em `index.ts`, testes de contrato via `inject`).
 *
 * Rotas públicas: `/api/health`, `/api/auth/*`
 * Lookup autenticado (sem tenant): `authenticated-lookup` — onboarding.
 * Demais rotas protegidas: `protected-api` (JWT + tenant).
 */
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify, { type FastifyInstance, type RouteOptions } from "fastify";
import type { PrismaClient } from "./generated/prisma/client.js";
import { assertProductionSecurityConfig } from "./lib/auth/production-env.js";
import { buildCorsOptions } from "./lib/http/cors-config.js";
import { registerGlobalErrorHandler } from "./lib/http/error-handler.js";
import { buildHelmetOptions } from "./lib/http/helmet-config.js";
import { authController } from "./modules/auth/presentation/controllers/auth.controller.js";
import { healthController } from "./modules/health/presentation/controllers/health.controller.js";
import { authPlugin } from "./plugins/auth/index.js";
import { authenticatedLookupPlugin } from "./plugins/authenticated-lookup.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { protectedApiPlugin } from "./plugins/protected-api.js";

export type BuildAppOptions = {
  logger?: boolean;
  /** Substitui o client Prisma (testes de contrato usam um fake). */
  prisma?: PrismaClient;
  /** Observa cada rota registrada (snapshot de rotas nos testes de contrato). */
  onRoute?: (route: RouteOptions) => void;
};

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const trustProxy = process.env.TRUST_PROXY === "true" || process.env.NODE_ENV === "production";
  const app = Fastify({ logger: options.logger ?? true, trustProxy });

  assertProductionSecurityConfig();

  if (options.onRoute) {
    app.addHook("onRoute", options.onRoute);
  }

  registerGlobalErrorHandler(app);

  await app.register(helmet, buildHelmetOptions());
  await app.register(cors, buildCorsOptions());
  await app.register(prismaPlugin, { client: options.prisma });
  await app.register(authPlugin);

  await app.register(healthController, { prefix: "/api" });
  await app.register(authController, { prefix: "/api" });
  await app.register(authenticatedLookupPlugin, { prefix: "/api" });
  await app.register(protectedApiPlugin, { prefix: "/api" });

  return app;
}
