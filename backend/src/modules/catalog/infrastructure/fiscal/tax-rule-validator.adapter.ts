import { createTaxModule } from "../../../tax/index.js";
import type { TaxRuleValidatorPort } from "../../domain/ports/tax-rule-validator.port.js";

export class TaxRuleValidatorAdapter implements TaxRuleValidatorPort {
  async assertProductTaxRuleBaseId(
    tenantId: string,
    taxRuleBaseId: string,
    tenantUf: string,
  ): Promise<void> {
    await createTaxModule().assertProductTaxRuleBaseId.execute(
      tenantId,
      taxRuleBaseId,
      tenantUf,
    );
  }
}
