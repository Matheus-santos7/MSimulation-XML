import { Inject, Injectable } from "@nestjs/common";
import type { FastifyBaseLogger } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { LOGGER, PRISMA } from "../../nest/tokens.js";
import type { DatabaseStatus, HealthResponseDTO } from "./dtos/health.response.dto.js";

/** Verifica se a API alcança o banco. Usa o client raiz: o health não abre transação nem RLS. */
@Injectable()
export class HealthService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(LOGGER) private readonly logger: FastifyBaseLogger,
  ) {}

  async check(): Promise<HealthResponseDTO> {
    const database = await this.checkDatabase();

    return {
      status: database === "ok" ? "ok" : "degraded",
      service: "api",
      database,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<DatabaseStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return "ok";
    } catch (err) {
      this.logger.error({ err }, "Health check: falha ao consultar o banco");

      return "unavailable";
    }
  }
}
