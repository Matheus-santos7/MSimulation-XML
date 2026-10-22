import { Inject, Module, type OnModuleInit } from "@nestjs/common";
import type { FastifyBaseLogger } from "fastify";
import { registerFiscalTransactionCommitHook } from "../../lib/db/prisma-tx.js";
import { LOGGER } from "../../nest/tokens.js";
import { PrismaNfeXmlContentResolverAdapter } from "../fiscal-documents/infrastructure/xml/prisma-nfe-xml-content-resolver.adapter.js";
import { ValidationInsightsUseCase } from "./insights/use-cases/validation-insights.usecase.js";
import { ValidationInsightsController } from "./insights/validation-insights.controller.js";
import { ValidationInsightsRepository } from "./insights/validation-insights.repository.js";
import { NfeValidationController } from "./nfe-validation/nfe-validation.controller.js";
import { NFE_XML_CONTENT_RESOLVER } from "./nfe-validation/types/nfe-xml-content-resolver.types.js";
import { NfeValidationBackfillUseCase } from "./nfe-validation/use-cases/nfe-validation-backfill.usecase.js";
import { FiscalValidatorProvider } from "./providers/fiscal-validator/fiscal-validator.provider.js";
import { ValidatorStatusController } from "./validator-status/validator-status.controller.js";

/** Limite de NF-es pendentes revalidadas por disparo de pós-commit. */
const NFE_VALIDATION_BACKFILL_TRIGGER_LIMIT = 10;

/**
 * Validação fiscal das NF-es no validador MCP.
 *
 * | Pasta | Rotas |
 * |-------|-------|
 * | `nfe-validation/` | POST /fiscal-validation/backfill (ADMIN) e o disparo pós-commit |
 * | `insights/` | GET /fiscal-validation/insights |
 * | `validator-status/` | GET /fiscal-validation/status |
 * | `providers/fiscal-validator/` | cliente HTTP do fiscal-validator-proxy |
 */
@Module({
  controllers: [NfeValidationController, ValidationInsightsController, ValidatorStatusController],
  providers: [
    FiscalValidatorProvider,
    { provide: NFE_XML_CONTENT_RESOLVER, useClass: PrismaNfeXmlContentResolverAdapter },
    NfeValidationBackfillUseCase,
    ValidationInsightsRepository,
    ValidationInsightsUseCase,
  ],
})
export class FiscalValidationModule implements OnModuleInit {
  constructor(
    @Inject(NfeValidationBackfillUseCase) private readonly backfill: NfeValidationBackfillUseCase,
    @Inject(LOGGER) private readonly logger: FastifyBaseLogger,
  ) {}

  /**
   * Revalidação assíncrona de NF-e (G2): `persistNfeXmlAutorizado` só grava status PENDING
   * dentro da transação; o commit de qualquer transação fiscal aciona aqui o backfill,
   * fora do caminho crítico de DB.
   */
  onModuleInit(): void {
    registerFiscalTransactionCommitHook((db, tenantId) => {
      this.backfill
        .execute(db, tenantId, { limit: NFE_VALIDATION_BACKFILL_TRIGGER_LIMIT })
        .catch((err: unknown) => {
          this.logger.error(
            { err, tenantId },
            "Falha ao acionar validação assíncrona de NF-e pendente",
          );
        });
    });
  }
}
