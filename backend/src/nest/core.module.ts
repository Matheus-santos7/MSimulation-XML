import { Global, Module, type DynamicModule } from "@nestjs/common";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { appConfig, ConfigService } from "../config/config.service.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { JWT, LOGGER, PRISMA, RATE_LIMITS, type RateLimits } from "./tokens.js";

export type CoreDependencies = {
  prisma: PrismaClient;
  rateLimits: RateLimits;
  logger: FastifyBaseLogger;
  jwt: FastifyInstance["jwt"];
};

/**
 * Dependências de infraestrutura visíveis em todos os módulos (Prisma, limitadores, logger,
 * JWT e `ConfigService`, injetado com `@Inject(ConfigService)`).
 */
@Global()
@Module({})
export class CoreModule {
  static register(dependencies: CoreDependencies): DynamicModule {
    return {
      module: CoreModule,
      providers: [
        { provide: PRISMA, useValue: dependencies.prisma },
        { provide: RATE_LIMITS, useValue: dependencies.rateLimits },
        { provide: LOGGER, useValue: dependencies.logger },
        { provide: JWT, useValue: dependencies.jwt },
        { provide: ConfigService, useValue: appConfig },
      ],
      exports: [PRISMA, RATE_LIMITS, LOGGER, JWT, ConfigService],
    };
  }
}
