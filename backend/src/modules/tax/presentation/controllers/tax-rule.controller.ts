import type { FastifyPluginAsync } from "fastify";
import { tenantIdFromRequest } from "../../../../lib/auth/request-context.js";
import { handleRouteError } from "../../../../lib/http/domain-errors.js";
import { requireAdminHook } from "../../../../plugins/contexts/guards.js";
import { TaxRuleError } from "../../domain/errors/tax-rule.error.js";
import { createTaxModule } from "../../infrastructure/factory/tax-module.factory.js";
import { resolveTaxRuleSpreadsheetUpload } from "../helpers/tax-rule-import.helper.js";
import {
  taxRuleImportRowSchema,
  taxRulesBulkBodySchema,
} from "../schemas/tax.schemas.js";

/** Mapeamento de erros de regra fiscal para HTTP. */
const TAX_RULE_ERROR_MAPPINGS = [{ type: TaxRuleError, status: 400 }] as const;

/**
 * Controller HTTP de regras tributárias.
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | GET | `/tax-rules/catalog` | GetTaxRuleCatalogUseCase |
 * | GET | `/tax-rules` | GetTaxRulesUseCase |
 * | POST | `/tax-rules/bulk-upsert` | BulkUpsertTaxRulesUseCase |
 * | POST | `/tax-rules/import-spreadsheet` | ImportTaxRulesSpreadsheetUseCase |
 * | DELETE | `/tax-rules` | DeleteAllTaxRulesUseCase (ADMIN) |
 */
export const taxRuleController: FastifyPluginAsync = async (app) => {
  const tax = createTaxModule(app.prisma);

  app.get("/tax-rules/catalog", async (req) => {
    const tenantId = tenantIdFromRequest(req);
    return tax.getTaxRuleCatalog.execute(tenantId);
  });

  app.get("/tax-rules", async (req) => {
    const tenantId = tenantIdFromRequest(req);
    return tax.getTaxRules.execute(tenantId);
  });

  app.post("/tax-rules/bulk-upsert", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const { rows } = taxRulesBulkBodySchema.parse(req.body);
    const result = await tax.bulkUpsertTaxRules.execute(tenantId, rows);
    return reply.status(200).send(result);
  });

  app.post("/tax-rules/import-spreadsheet", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const payload = await resolveTaxRuleSpreadsheetUpload(req);
    if (!payload.ok) {
      return reply.status(payload.status).send({
        error: payload.error,
        ...(payload.details ? { details: payload.details } : {}),
      });
    }

    try {
      const result = await tax.importTaxRulesSpreadsheet.execute(tenantId, payload.buffer);
      return reply.status(200).send(result);
    } catch (error) {
      if (handleRouteError(reply, error, { mappings: [...TAX_RULE_ERROR_MAPPINGS] })) return;
      throw error;
    }
  });

  app.delete("/tax-rules", { onRequest: [requireAdminHook] }, async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    try {
      return await tax.deleteAllTaxRules.execute(tenantId);
    } catch (error) {
      if (handleRouteError(reply, error, { mappings: [...TAX_RULE_ERROR_MAPPINGS] })) return;
      throw error;
    }
  });
};
