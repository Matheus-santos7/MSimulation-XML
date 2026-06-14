import type { FastifyPluginAsync } from "fastify";
import { tenantIdFromRequest } from "../../../../lib/auth/request-context.js";
import { handleRouteError } from "../../../../lib/http/domain-errors.js";
import { DocumentCancellationError } from "../../domain/errors/document-cancellation.error.js";
import { DocumentReturnError } from "../../domain/errors/document-return.error.js";
import { NumberInutilizationError } from "../../domain/errors/number-inutilization.error.js";
import { createFiscalDocumentsModule } from "../../infrastructure/factory/fiscal-documents-module.factory.js";
import {
  cancelDocumentBodySchema,
  inutilizeNumberBodySchema,
  nfeAccessKeyParamSchema,
} from "../schemas/fiscal-document.schemas.js";

const NFE_LIFECYCLE_ERRORS = [
  NumberInutilizationError,
  DocumentReturnError,
  DocumentCancellationError,
] as const;

/**
 * NF-e lifecycle routes: inutilization, return, cancellation.
 * Static `/nfes/inutilizar` is registered before parameterized routes.
 */
export const nfeLifecycleController: FastifyPluginAsync = async (app) => {
  const fiscalDocuments = createFiscalDocumentsModule();

  app.post("/nfes/inutilizar", async (req, reply) => {
    try {
      const tenantId = tenantIdFromRequest(req);
      const body = inutilizeNumberBodySchema.parse(req.body ?? {});
      const result = await fiscalDocuments.inutilizeNumber.execute({
        tenantId,
        series: body.serie,
        numberStart: body.numeroIni,
        numberEnd: body.numeroFim,
        justification: body.xJust,
      });
      return reply.status(201).send(result);
    } catch (error) {
      if (handleRouteError(reply, error, { statusErrors: [...NFE_LIFECYCLE_ERRORS] })) return;
      throw error;
    }
  });

  app.post("/nfes/:chave/devolucao", async (req, reply) => {
    try {
      const tenantId = tenantIdFromRequest(req);
      const { chave } = nfeAccessKeyParamSchema.parse(req.params);
      const result = await fiscalDocuments.processReturn.execute({
        tenantId,
        saleNfeKey: chave,
      });
      return reply.status(201).send(result);
    } catch (error) {
      if (handleRouteError(reply, error, { statusErrors: [...NFE_LIFECYCLE_ERRORS] })) return;
      throw error;
    }
  });

  app.post("/nfes/:chave/cancelamento", async (req, reply) => {
    try {
      const tenantId = tenantIdFromRequest(req);
      const { chave } = nfeAccessKeyParamSchema.parse(req.params);
      const body = cancelDocumentBodySchema.parse(req.body ?? {});
      const result = await fiscalDocuments.cancelDocument.execute({
        tenantId,
        nfeKey: chave,
        justification: body.xJust,
      });
      return reply.status(200).send(result);
    } catch (error) {
      if (handleRouteError(reply, error, { statusErrors: [...NFE_LIFECYCLE_ERRORS] })) return;
      throw error;
    }
  });
};
