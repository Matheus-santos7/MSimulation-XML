import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import type { NfeXmlContentResolverPort } from "../../domain/ports/nfe-xml-content-resolver.port.js";
import type { McpFiscalValidatorPort } from "../../domain/ports/mcp-fiscal-validator.port.js";
import { BackfillPendingNfeValidationUseCase } from "../../application/use-cases/backfill-pending-nfe-validation.use-case.js";
import { GetValidationInsightsUseCase } from "../../application/use-cases/get-validation-insights.use-case.js";
import { GetValidatorHealthUseCase } from "../../application/use-cases/get-validator-health.use-case.js";
import { ValidateNfeXmlUseCase } from "../../application/use-cases/validate-nfe-xml.use-case.js";
import { loadFiscalValidatorConfig } from "../config/fiscal-validator.config.js";
import { HttpMcpFiscalValidatorAdapter } from "../external/http-mcp-fiscal-validator.adapter.js";
import { PrismaValidationInsightsRepository } from "../prisma/prisma-validation-insights.repository.js";

export type FiscalValidationModuleDeps = {
  validator?: McpFiscalValidatorPort;
  nfeXmlResolver?: NfeXmlContentResolverPort;
};

let cachedModule: ReturnType<typeof buildFiscalValidationModule> | null = null;

function buildFiscalValidationModule(deps: FiscalValidationModuleDeps = {}) {
  const config = loadFiscalValidatorConfig();
  const validator = deps.validator ?? new HttpMcpFiscalValidatorAdapter(config.apiUrl);

  return {
    config,
    validateNfeXml: new ValidateNfeXmlUseCase(validator, config),
    getValidatorHealth: new GetValidatorHealthUseCase(config),
    createBackfillPendingNfeValidation: (db: DbClient) => {
      if (!deps.nfeXmlResolver) {
        throw new Error("Backfill requires nfeXmlResolver in createFiscalValidationModule deps");
      }
      return new BackfillPendingNfeValidationUseCase(validator, deps.nfeXmlResolver, config);
    },
    createGetValidationInsights: (db: DbClient) =>
      new GetValidationInsightsUseCase(new PrismaValidationInsightsRepository(db)),
  };
}

/** Composition root for the fiscal-validation bounded context. */
export function createFiscalValidationModule(deps?: FiscalValidationModuleDeps) {
  if (deps) {
    return buildFiscalValidationModule(deps);
  }
  if (!cachedModule) {
    cachedModule = buildFiscalValidationModule();
  }
  return cachedModule;
}

/** Resets cached module (tests only). */
export function resetFiscalValidationModuleForTests(): void {
  cachedModule = null;
}
