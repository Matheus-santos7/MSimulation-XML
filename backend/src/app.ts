/**
 * Monta a API sem escutar porta (boot em `index.ts`, testes de contrato via `inject`).
 *
 * Nest (controllers em `src/modules/<feature>/<feature>.module.ts`) roda sobre a mesma
 * instância Fastify dos plugins legados enquanto a migração não termina.
 *
 * Rotas públicas: `/api/health`, `/api/auth/*`
 * Lookup autenticado (sem tenant): `authenticated-lookup` — onboarding.
 * Demais rotas protegidas: `protected-api` (JWT + tenant).
 */
import "reflect-metadata";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import Fastify, { type FastifyInstance, type RouteOptions } from "fastify";
import type { PrismaClient } from "./generated/prisma/client.js";
import { assertProductionSecurityConfig } from "./lib/auth/production-env.js";
import { buildCorsOptions } from "./lib/http/cors-config.js";
import { registerGlobalErrorHandler } from "./lib/http/error-handler.js";
import { buildHelmetOptions } from "./lib/http/helmet-config.js";
import {
  createRateLimitHandler,
  PROTECTED_API_RATE_LIMIT,
  registerRootRateLimit,
  type RateLimitHandler,
} from "./lib/http/rate-limit.js";
import { authController } from "./modules/auth/presentation/controllers/auth.controller.js";
import { AppModule } from "./nest/app.module.js";
import { ApiExceptionFilter } from "./nest/http/api-exception.filter.js";
import { authPlugin } from "./plugins/auth/index.js";
import { authenticatedLookupPlugin } from "./plugins/authenticated-lookup.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { protectedApiPlugin } from "./plugins/protected-api.js";

const API_PREFIX = "api";

/** Uploads de planilha e XML: um arquivo por requisição, até 15 MB. */
const UPLOAD_LIMITS = { fileSize: 15 * 1024 * 1024, files: 1 };

export type BuildAppOptions = {
  logger?: boolean;
  /** Substitui o client Prisma (testes de contrato usam um fake). */
  prisma?: PrismaClient;
  /** Observa cada rota registrada (snapshot de rotas nos testes de contrato). */
  onRoute?: (route: RouteOptions) => void;
};

async function buildFastify(options: BuildAppOptions): Promise<FastifyInstance> {
  const trustProxy = process.env.TRUST_PROXY === "true" || process.env.NODE_ENV === "production";
  const app = Fastify({ logger: options.logger ?? true, trustProxy });

  assertProductionSecurityConfig();

  if (options.onRoute) {
    app.addHook("onRoute", options.onRoute);
  }

  await app.register(helmet, buildHelmetOptions());
  await app.register(cors, buildCorsOptions());
  await registerRootRateLimit(app);
  await app.register(multipart, { limits: UPLOAD_LIMITS });
  await app.register(prismaPlugin, { client: options.prisma });
  await app.register(authPlugin);

  return app;
}

/**
 * Plugins Fastify ainda não migrados, num escopo próprio com o error handler legado
 * (na raiz quem responde é o handler do Nest, que passa pelo `ApiExceptionFilter`).
 * Cada fase da migração remove um registro daqui.
 */
async function registerLegacyRoutes(app: FastifyInstance, protectedApiRateLimit: RateLimitHandler): Promise<void> {
  await app.register(async legacy => {
    registerGlobalErrorHandler(legacy);

    await legacy.register(authController, { prefix: `/${API_PREFIX}` });
    await legacy.register(authenticatedLookupPlugin, { prefix: `/${API_PREFIX}` });
    await legacy.register(protectedApiPlugin, { prefix: `/${API_PREFIX}`, rateLimit: protectedApiRateLimit });
  });
}

export async function buildApp(options: BuildAppOptions = {}): Promise<NestFastifyApplication> {
  const fastify = await buildFastify(options);
  const protectedApiRateLimit = createRateLimitHandler(fastify, PROTECTED_API_RATE_LIMIT);

  await registerLegacyRoutes(fastify, protectedApiRateLimit);

  const appModule = AppModule.register({
    prisma: fastify.prisma,
    rateLimits: {
      protectedApi: protectedApiRateLimit,
      create: routeOptions => createRateLimitHandler(fastify, routeOptions),
    },
  });
  const nest = await NestFactory.create<NestFastifyApplication>(appModule, new FastifyAdapter(fastify), {
    // Os parsers de corpo são os do Fastify (JSON) e do @fastify/multipart; o Nest não registra os dele.
    bodyParser: false,
    logger: options.logger === false ? false : ["error", "warn"],
    abortOnError: false,
  });

  nest.setGlobalPrefix(API_PREFIX);
  nest.useGlobalFilters(new ApiExceptionFilter());
  await nest.init();

  return nest;
}
