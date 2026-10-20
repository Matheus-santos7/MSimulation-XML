import { Controller, Get, Inject, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { PrismaClient } from "../../../../generated/prisma/client.js";
import { PRISMA } from "../../../../nest/tokens.js";

const HTTP_SERVICE_UNAVAILABLE = 503;

const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  service: z.literal("api"),
  database: z.enum(["ok", "unavailable"]),
  timestamp: z.string().datetime(),
});

type HealthResponse = z.infer<typeof healthResponseSchema>;

/** Health check público (ALB e healthcheck do container). Sem guard, rate limit ou transação. */
@Controller("health")
export class HealthController {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  @Get()
  async check(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<HealthResponse> {
    let database: HealthResponse["database"] = "ok";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      request.log.error({ err }, "Health check: falha ao consultar o banco");
      database = "unavailable";
    }

    const body = healthResponseSchema.parse({
      status: database === "ok" ? "ok" : "degraded",
      service: "api",
      database,
      timestamp: new Date().toISOString(),
    });

    if (database === "unavailable") {
      reply.status(HTTP_SERVICE_UNAVAILABLE);
    }

    return body;
  }
}
