import type { FastifyPluginAsync } from "fastify";
import { tenantIdFromRequest } from "../../../../lib/auth/request-context.js";
import { handleRouteError } from "../../../../lib/http/domain-errors.js";
import { requireAdminHook } from "../../../../plugins/contexts/guards.js";
import { LogisticsUnitError } from "../../domain/errors/logistics-unit.error.js";
import { createLogisticsModule } from "../../infrastructure/factory/logistics-module.factory.js";
import { resolveBulkImportPayload } from "../helpers/bulk-import.helper.js";
import { logisticsUnitIdParam, logisticsUnitsListQuery } from "../schemas/logistics.schemas.js";

/** Mapeamento de erros de unidade logística para HTTP. */
const LOGISTICS_UNIT_ERROR_MAPPINGS = [{ type: LogisticsUnitError, status: 400 }] as const;

/**
 * Controller HTTP de unidades logísticas Meli Full.
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | GET | `/unidades-logisticas` | ListLogisticsUnitsUseCase |
 * | GET | `/unidades-logisticas/:id` | GetLogisticsUnitByIdUseCase |
 * | POST | `/unidades-logisticas/bulk-import` | BulkImportLogisticsUnitsUseCase (ADMIN) |
 * | PATCH | `/unidades-logisticas/:id/padrao` | SetDefaultLogisticsUnitUseCase |
 */
export const logisticsUnitController: FastifyPluginAsync = async (app) => {
  const logistics = createLogisticsModule();

  app.get("/unidades-logisticas", async (req) => {
    const tenantId = tenantIdFromRequest(req);
    const q = logisticsUnitsListQuery.parse(req.query);
    const ativa = q.ativa === "false" ? false : q.ativa === "true" ? true : undefined;
    return logistics.listLogisticsUnits.execute(tenantId, { ativa, q: q.q, cnpj: q.cnpj });
  });

  app.get("/unidades-logisticas/:id", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const { id } = logisticsUnitIdParam.parse(req.params);
    const row = await logistics.getLogisticsUnitById.execute(tenantId, id);
    if (!row) return reply.status(404).send({ error: "Unidade não encontrada" });
    return row;
  });

  app.post(
    "/unidades-logisticas/bulk-import",
    { onRequest: [requireAdminHook] },
    async (req, reply) => {
      const tenantId = tenantIdFromRequest(req);
      const payload = await resolveBulkImportPayload(req);
      if (!payload.ok) {
        return reply.status(payload.status).send({
          error: payload.error,
          ...(payload.details !== undefined ? { details: payload.details } : {}),
        });
      }

      try {
        const result = await logistics.bulkImportLogisticsUnits.execute(
          tenantId,
          payload.rows,
          payload.enrichCep,
        );
        return {
          ...result,
          ...(payload.parseErrors.length > 0 ? { parseErrors: payload.parseErrors } : {}),
        };
      } catch (error) {
        if (handleRouteError(reply, error, { mappings: [...LOGISTICS_UNIT_ERROR_MAPPINGS] })) {
          return;
        }
        throw error;
      }
    },
  );

  app.patch("/unidades-logisticas/:id/padrao", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const { id } = logisticsUnitIdParam.parse(req.params);
    try {
      return await logistics.setDefaultLogisticsUnit.execute(tenantId, id);
    } catch (error) {
      if (handleRouteError(reply, error, { mappings: [...LOGISTICS_UNIT_ERROR_MAPPINGS] })) {
        return;
      }
      throw error;
    }
  });
};
