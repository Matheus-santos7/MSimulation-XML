import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  service: z.literal("api"),
  database: z.enum(["ok", "unavailable"]),
  timestamp: z.string().datetime(),
});

export const healthController: FastifyPluginAsync = async (app) => {
  app.get("/health", async (_req, reply) => {
    let database: "ok" | "unavailable" = "ok";
    try {
      await app.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = "unavailable";
    }

    const body = {
      status: database === "ok" ? ("ok" as const) : ("degraded" as const),
      service: "api" as const,
      database,
      timestamp: new Date().toISOString(),
    };
    const parsed = healthResponseSchema.parse(body);

    if (database === "unavailable") {
      return reply.status(503).send(parsed);
    }
    return parsed;
  });
};
