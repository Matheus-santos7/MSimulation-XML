/**
 * Monta a API sem escutar porta (boot em `index.ts`, testes de contrato via `inject`).
 *
 * NestJS sobre Fastify. A instância Fastify é montada aqui com os plugins de borda
 * (helmet, CORS, rate limit, multipart, Prisma, JWT) e entregue ao `FastifyAdapter`;
 * as rotas ficam nos controllers de `src/modules/<feature>/<feature>.module.ts`.
 *
 * Acesso por controller (`src/nest/api-access.decorators.ts`):
 * - públicas: `/api/health`, `/api/auth/*` (algumas exigem só JWT);
 * - só JWT, sem tenant: `/api/lookup/*` (onboarding);
 * - `@ProtectedApi()`: JWT + empresa + e-mail confirmado + transação com RLS.
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
import { buildHelmetOptions } from "./lib/http/helmet-config.js";
import {
  createRateLimitHandler,
  PROTECTED_API_RATE_LIMIT,
  registerRootRateLimit,
} from "./lib/http/rate-limit.js";
import { AppModule } from "./nest/app.module.js";
import { ApiExceptionFilter } from "./nest/http/api-exception.filter.js";
import { authPlugin } from "./plugins/auth/index.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { appConfig } from "./config/config.service.js";

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
  const trustProxy = appConfig.trustProxy === "true" || appConfig.isProduction;
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

export async function buildApp(options: BuildAppOptions = {}): Promise<NestFastifyApplication> {
  const fastify = await buildFastify(options);

  const appModule = AppModule.register({
    prisma: fastify.prisma,
    logger: fastify.log,
    jwt: fastify.jwt,
    rateLimits: {
      protectedApi: createRateLimitHandler(fastify, PROTECTED_API_RATE_LIMIT),
      create: (routeOptions) => createRateLimitHandler(fastify, routeOptions),
    },
  });
  const nest = await NestFactory.create<NestFastifyApplication>(
    appModule,
    new FastifyAdapter(fastify),
    {
      // Os parsers de corpo são os do Fastify (JSON) e do @fastify/multipart; o Nest não registra os dele.
      bodyParser: false,
      logger: options.logger === false ? false : ["error", "warn"],
      abortOnError: false,
    },
  );

  nest.setGlobalPrefix(API_PREFIX);
  // Também trata os erros fora do pipeline do Nest (parser de corpo, 404 de rota): o
  // error handler que o Nest registra no Fastify passa pelos filtros globais.
  nest.useGlobalFilters(new ApiExceptionFilter());
  await nest.init();

  return nest;
}
