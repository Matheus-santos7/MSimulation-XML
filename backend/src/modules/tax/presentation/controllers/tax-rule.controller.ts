import type { FastifyPluginAsync } from "fastify";
import { tenantIdFromRequest } from "../../../../lib/auth/request-context.js";
import { handleRouteError } from "../../../../lib/http/domain-errors.js";
import { requireAdminHook } from "../../../../plugins/contexts/guards.js";
import { TaxRuleError } from "../../domain/errors/tax-rule.error.js";
import { createTaxModule } from "../../infrastructure/factory/tax-module.factory.js";
import {
  taxRuleBaseIdParamSchema,
  taxRuleGroupQuerySchema,
  taxRulesBulkBodySchema,
} from "../schemas/tax.schemas.js";

const TAX_RULE_ERROR_MAPPINGS = [{ type: TaxRuleError, status: 400 }] as const;

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

  app.delete("/tax-rules", { onRequest: [requireAdminHook] }, async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    try {
      return await tax.deleteAllTaxRules.execute(tenantId);
    } catch (error) {
      if (handleRouteError(reply, error, { mappings: [...TAX_RULE_ERROR_MAPPINGS] })) return;
      throw error;
    }
  });

  app.delete("/tax-rules/:baseId", { onRequest: [requireAdminHook] }, async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const { baseId } = taxRuleBaseIdParamSchema.parse(req.params);
    const { origin } = taxRuleGroupQuerySchema.parse(req.query);

    try {
      return await tax.deleteTaxRuleGroup.execute(
        tenantId,
        decodeURIComponent(baseId),
        origin.toUpperCase(),
      );
    } catch (error) {
      if (handleRouteError(reply, error, { mappings: [...TAX_RULE_ERROR_MAPPINGS] })) return;
      throw error;
    }
  });
};
