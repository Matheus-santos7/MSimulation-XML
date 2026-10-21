import { Global, Module, type DynamicModule } from "@nestjs/common";
import type { FastifyBaseLogger } from "fastify";
import type { PrismaClient } from "../generated/prisma/client.js";
import { LOGGER, PRISMA, RATE_LIMITS, type RateLimits } from "./tokens.js";

export type CoreDependencies = {
  prisma: PrismaClient;
  rateLimits: RateLimits;
  logger: FastifyBaseLogger;
};

/** Dependências de infraestrutura visíveis em todos os módulos (Prisma, limitadores e logger). */
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
      ],
      exports: [PRISMA, RATE_LIMITS, LOGGER],
    };
  }
}
