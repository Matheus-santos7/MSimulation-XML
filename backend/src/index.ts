/**
 *
 * Rotas públicas: `/api/health`, `/api/auth/*`
 * Lookup autenticado (sem tenant): `authenticated-lookup` — onboarding.
 * Demais rotas protegidas: `protected-api` (JWT + tenant).
 */
import "dotenv/config";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify from "fastify";
import { buildCorsOptions } from "./lib/http/cors-config.js";
import { registerGlobalErrorHandler } from "./lib/http/error-handler.js";
import { buildHelmetOptions } from "./lib/http/helmet-config.js";
import { authPlugin } from "./plugins/auth/index.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { authenticatedLookupPlugin } from "./plugins/authenticated-lookup.js";
import { protectedApiPlugin } from "./plugins/protected-api.js";
import { healthRoutes } from "./routes/health/index.js";
import { authController } from "./modules/auth/index.js";
const trustProxy = process.env.TRUST_PROXY === "true" || process.env.NODE_ENV === "production";
const app = Fastify({ logger: true, trustProxy });

registerGlobalErrorHandler(app);

await app.register(helmet, buildHelmetOptions());
await app.register(cors, buildCorsOptions());
await app.register(prismaPlugin);
await app.register(authPlugin);

await app.register(healthRoutes, { prefix: "/api" });
await app.register(authController, { prefix: "/api" });
await app.register(authenticatedLookupPlugin, { prefix: "/api" });
await app.register(protectedApiPlugin, { prefix: "/api" });

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

await app.listen({ port, host });
app.log.info(`API em http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
