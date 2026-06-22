import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { tenantIdFromRequest } from "../../../../lib/auth/request-context.js";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import { requireAdminHook } from "../../../../plugins/contexts/guards.js";

const backfillValidationBodySchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
});

export type FiscalValidationModule = {
  getValidatorHealth: { execute(): Promise<unknown> };
  createGetValidationInsights(db: unknown): { execute(tenantId: string): Promise<unknown> };
  createBackfillPendingNfeValidation(db: unknown): {
    execute(db: unknown, tenantId: string, options: { limit?: number }): Promise<unknown>;
  };
};

export type FiscalValidationControllerDeps = {
  module: FiscalValidationModule;
};

/** HTTP routes for MCP fiscal validation (status, insights, backfill). */
export function createFiscalValidationController(
  deps: FiscalValidationControllerDeps,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/fiscal-validation/insights", async (req) => {
      const tenantId = tenantIdFromRequest(req);
      return deps.module.createGetValidationInsights(getDbClient()).execute(tenantId);
    });

    app.get("/fiscal-validation/status", async () => {
      return deps.module.getValidatorHealth.execute();
    });

    app.post("/fiscal-validation/backfill", { onRequest: [requireAdminHook] }, async (req) => {
      const tenantId = tenantIdFromRequest(req);
      const body = backfillValidationBodySchema.parse(req.body ?? {});
      const db = getDbClient();
      return deps.module.createBackfillPendingNfeValidation(db).execute(db, tenantId, {
        limit: body.limit,
      });
    });
  };
}
