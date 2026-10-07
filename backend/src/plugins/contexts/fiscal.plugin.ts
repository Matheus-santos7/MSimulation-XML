import multipart from "@fastify/multipart";
import type { FastifyPluginAsync } from "fastify";
import { registerFiscalTransactionCommitHook } from "../../lib/db/prisma-tx.js";
import { cteController } from "../../modules/fiscal-documents/presentation/controllers/cte.controller.js";
import { fiscalObservabilityController } from "../../modules/fiscal-documents/presentation/controllers/fiscal-observability.controller.js";
import { nfeController } from "../../modules/fiscal-documents/presentation/controllers/nfe.controller.js";
import { nfeLifecycleController } from "../../modules/fiscal-documents/presentation/controllers/nfe-lifecycle.controller.js";
import { PrismaNfeXmlContentResolverAdapter } from "../../modules/fiscal-documents/infrastructure/xml/prisma-nfe-xml-content-resolver.adapter.js";
import { createFiscalValidationModule } from "../../modules/fiscal-validation/infrastructure/factory/fiscal-validation-module.factory.js";
import { createFiscalValidationController } from "../../modules/fiscal-validation/presentation/controllers/fiscal-validation.controller.js";
import { emitterSettingsController } from "../../modules/fiscal-settings/presentation/controllers/emitter-settings.controller.js";
import { orderController } from "../../modules/sales/presentation/controllers/order.controller.js";
import { taxRuleController } from "../../modules/tax/presentation/controllers/tax-rule.controller.js";

const fiscalValidationModule = createFiscalValidationModule({
  nfeXmlResolver: new PrismaNfeXmlContentResolverAdapter(),
});

/** Limite de NF-es pendentes revalidadas por disparo de pós-commit. */
const NFE_VALIDATION_BACKFILL_TRIGGER_LIMIT = 10;

/**
 * Núcleo fiscal: documentos, pedidos, configurações do emissor ML.
 */
export const fiscalContextPlugin: FastifyPluginAsync = async (app) => {
  // Revalidação assíncrona de NF-e (G2): persistNfeXmlAutorizado só grava
  // status PENDING dentro da transação; o commit de qualquer transação
  // fiscal aciona aqui o backfill, fora do caminho crítico de DB.
  registerFiscalTransactionCommitHook((db, tenantId) => {
    fiscalValidationModule
      .createBackfillPendingNfeValidation(db)
      .execute(db, tenantId, { limit: NFE_VALIDATION_BACKFILL_TRIGGER_LIMIT })
      .catch((err: unknown) => {
        app.log.error({ err, tenantId }, "Falha ao acionar validação assíncrona de NF-e pendente");
      });
  });

  await app.register(multipart, {
    limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  });
  await app.register(nfeLifecycleController);
  await app.register(nfeController);
  await app.register(cteController);
  await app.register(fiscalObservabilityController);
  await app.register(createFiscalValidationController({ module: fiscalValidationModule }));
  await app.register(taxRuleController);
  await app.register(emitterSettingsController);
  await app.register(orderController);
};
