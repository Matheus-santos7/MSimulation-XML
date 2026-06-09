import type { FastifyInstance } from "fastify";
import { tenantIdFromRequest } from "../../lib/auth/request-context.js";
import { requireAdminHook } from "../../plugins/contexts/guards.js";
import {
  deleteAllTaxRules,
  deleteTaxRuleGroup,
  listTaxRuleCatalog,
  TaxRuleCatalogError,
} from "../../services/tax-rule-catalog-service.js";
import {
  taxRuleBaseIdParamSchema,
  taxRuleGroupQuerySchema,
  taxRulesBulkBodySchema,
} from "./schemas.js";

export function registerTaxRuleRoutes(app: FastifyInstance) {
  app.get("/tax-rules/catalog", async (req) => {
    const tid = tenantIdFromRequest(req);
    return listTaxRuleCatalog(app.prisma, tid);
  });

  app.get("/tax-rules", async (req) => {
    const tid = tenantIdFromRequest(req);
    const rows = await app.prisma.taxRule.findMany({
      where: { tenantId: tid },
      orderBy: { ruleId: "asc" },
    });
    return rows.map((r) => ({
      id: r.ruleId,
      nome: r.nome,
      tipo: r.tipo,
      uf: r.uf,
      origin: r.origin ?? undefined,
      cfop: r.cfop,
      aliquota: r.aliquota,
      transactionType: r.transactionType ?? undefined,
      customerType: r.customerType ?? undefined,
      source: r.source,
      payload: r.payload ?? undefined,
    }));
  });

  app.post("/tax-rules/bulk-upsert", async (req, reply) => {
    const tid = tenantIdFromRequest(req);
    const { rows } = taxRulesBulkBodySchema.parse(req.body);

    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const existing = await app.prisma.taxRule.findUnique({
        where: { tenantId_ruleId: { tenantId: tid, ruleId: row.ruleId } },
        select: { id: true },
      });

      await app.prisma.taxRule.upsert({
        where: { tenantId_ruleId: { tenantId: tid, ruleId: row.ruleId } },
        create: {
          tenantId: tid,
          ruleId: row.ruleId,
          nome: row.nome,
          tipo: row.tipo,
          uf: row.uf,
          cfop: row.cfop,
          aliquota: row.aliquota,
          transactionType: row.transactionType,
          customerType: row.customerType,
          origin: row.origin,
          source: "xlsx",
          payload: row.payload,
        },
        update: {
          nome: row.nome,
          tipo: row.tipo,
          uf: row.uf,
          cfop: row.cfop,
          aliquota: row.aliquota,
          transactionType: row.transactionType,
          customerType: row.customerType,
          origin: row.origin,
          source: "xlsx",
          payload: row.payload,
        },
      });

      if (existing) updated++;
      else created++;
    }

    return reply.status(200).send({ created, updated, total: rows.length });
  });

  app.delete("/tax-rules", { onRequest: [requireAdminHook] }, async (req, reply) => {
    const tid = tenantIdFromRequest(req);
    try {
      return await deleteAllTaxRules(app.prisma, tid);
    } catch (e) {
      if (e instanceof TaxRuleCatalogError) {
        return reply.status(400).send({ error: e.message });
      }
      throw e;
    }
  });

  app.delete("/tax-rules/:baseId", { onRequest: [requireAdminHook] }, async (req, reply) => {
    const tid = tenantIdFromRequest(req);
    const { baseId } = taxRuleBaseIdParamSchema.parse(req.params);
    const { origin } = taxRuleGroupQuerySchema.parse(req.query);

    try {
      return await deleteTaxRuleGroup(app.prisma, tid, decodeURIComponent(baseId), origin.toUpperCase());
    } catch (e) {
      if (e instanceof TaxRuleCatalogError) {
        return reply.status(400).send({ error: e.message });
      }
      throw e;
    }
  });
}
