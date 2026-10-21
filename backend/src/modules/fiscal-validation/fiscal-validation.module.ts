import { Inject, Module, type OnModuleInit } from "@nestjs/common";
import type { FastifyBaseLogger } from "fastify";
import { registerFiscalTransactionCommitHook } from "../../lib/db/prisma-tx.js";
import { LOGGER } from "../../nest/tokens.js";
import { PrismaNfeXmlContentResolverAdapter } from "../fiscal-documents/infrastructure/xml/prisma-nfe-xml-content-resolver.adapter.js";
import { FISCAL_VALIDATION, type FiscalValidationContext } from "./fiscal-validation.tokens.js";
import { createFiscalValidationModule } from "./infrastructure/factory/fiscal-validation-module.factory.js";
import { FiscalValidationController } from "./presentation/controllers/fiscal-validation.controller.js";

/** Limite de NF-es pendentes revalidadas por disparo de pós-commit. */
const NFE_VALIDATION_BACKFILL_TRIGGER_LIMIT = 10;

@Module({
  controllers: [FiscalValidationController],
  providers: [
    {
      provide: FISCAL_VALIDATION,
      useFactory: () => createFiscalValidationModule({ nfeXmlResolver: new PrismaNfeXmlContentResolverAdapter() }),
    },
  ],
})
export class FiscalValidationModule implements OnModuleInit {
  constructor(
    @Inject(FISCAL_VALIDATION) private readonly fiscalValidation: FiscalValidationContext,
    @Inject(LOGGER) private readonly logger: FastifyBaseLogger,
  ) {}

  /**
   * Revalidação assíncrona de NF-e (G2): `persistNfeXmlAutorizado` só grava status PENDING
   * dentro da transação; o commit de qualquer transação fiscal aciona aqui o backfill,
   * fora do caminho crítico de DB.
   */
  onModuleInit(): void {
    registerFiscalTransactionCommitHook((db, tenantId) => {
      this.fiscalValidation
        .createBackfillPendingNfeValidation(db)
        .execute(db, tenantId, { limit: NFE_VALIDATION_BACKFILL_TRIGGER_LIMIT })
        .catch((err: unknown) => {
          this.logger.error({ err, tenantId }, "Falha ao acionar validação assíncrona de NF-e pendente");
        });
    });
  }
}
