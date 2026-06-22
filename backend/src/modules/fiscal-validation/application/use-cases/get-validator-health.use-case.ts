import type { FiscalValidatorConfig } from "../../infrastructure/config/fiscal-validator.config.js";
import { probeValidatorHealth } from "../../infrastructure/external/validator-health.probe.js";

/** Returns MCP validator reachability for admin diagnostics. */
export class GetValidatorHealthUseCase {
  constructor(private readonly config: FiscalValidatorConfig) {}

  async execute() {
    return probeValidatorHealth(this.config);
  }
}
