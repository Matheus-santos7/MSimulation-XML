import { legacyTaxRuleService } from "../../../tax/index.js";
import type { TaxRuleCatalogEntry } from "../../../tax/index.js";
import type { TaxRuleValidatorPort } from "../../domain/ports/tax-rule-validator.port.js";

export class TaxRuleValidatorAdapter implements TaxRuleValidatorPort {
  async listProductTaxRuleCatalog(tenantId: string): Promise<TaxRuleCatalogEntry[]> {
    return legacyTaxRuleService().catalog(tenantId);
  }

  async assertProductTaxRuleBaseId(
    tenantId: string,
    taxRuleBaseId: string,
    tenantUf: string,
  ): Promise<void> {
    await legacyTaxRuleService().assertProductTaxRuleBaseId(
      tenantId,
      taxRuleBaseId,
      tenantUf,
    );
  }
}
