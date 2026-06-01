/**
 * Ponto de entrada da API Fastify (porta padrão 3001).
 *
 * Rotas públicas: `/api/health`, `/api/auth/*` (login, register, forgot/reset password), `/api/lookup/*`
 * Rotas protegidas: demais `/api/*` (JWT obrigatório, tenantId no token)
 */
import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { authPlugin } from "./plugins/auth/index.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { protectedApiPlugin } from "./plugins/protected-api.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth/index.js";
import { lookupRoutes } from "./routes/lookup.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(prismaPlugin);
await app.register(authPlugin);

await app.register(healthRoutes, { prefix: "/api" });
await app.register(lookupRoutes, { prefix: "/api" });
await app.register(authRoutes, { prefix: "/api" });
await app.register(protectedApiPlugin, { prefix: "/api" });

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

await app.listen({ port, host });
app.log.info(`API em http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
