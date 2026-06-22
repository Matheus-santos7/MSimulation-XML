export type { NfeMcpAudit, NfeMcpIssue, NfeValidationAchado } from "./domain/entities/nfe-mcp-audit.entity.js";
export {
  isNfeMcpAuditApproved,
  nfeMcpIssuesToErrors,
} from "./domain/entities/nfe-mcp-audit.entity.js";
export type { NfeValidationOutcome, NfeValidationStatus } from "./domain/entities/nfe-validation-outcome.entity.js";
export type { McpFiscalValidatorPort } from "./domain/ports/mcp-fiscal-validator.port.js";
export { resolveNfeValidation } from "./domain/services/resolve-nfe-validation.service.js";
export { ValidateNfeXmlUseCase } from "./application/use-cases/validate-nfe-xml.use-case.js";
export { BackfillPendingNfeValidationUseCase } from "./application/use-cases/backfill-pending-nfe-validation.use-case.js";
export type { NfeValidationBackfillResult } from "./application/use-cases/backfill-pending-nfe-validation.use-case.js";
export { GetValidationInsightsUseCase } from "./application/use-cases/get-validation-insights.use-case.js";
export { GetValidatorHealthUseCase } from "./application/use-cases/get-validator-health.use-case.js";
export {
  createFiscalValidationModule,
  resetFiscalValidationModuleForTests,
} from "./infrastructure/factory/fiscal-validation-module.factory.js";
export { toPrismaNfeValidationUpdate } from "./infrastructure/prisma/nfe-validation-persistence.mapper.js";
export {
  loadFiscalValidatorConfig,
  resolveFiscalValidatorApiUrl,
} from "./infrastructure/config/fiscal-validator.config.js";
export {
  FakeMcpFiscalValidatorAdapter,
  buildFakeMcpAudit,
} from "./infrastructure/external/fake-mcp-fiscal-validator.adapter.js";
export { createFiscalValidationController } from "./presentation/controllers/fiscal-validation.controller.js";
