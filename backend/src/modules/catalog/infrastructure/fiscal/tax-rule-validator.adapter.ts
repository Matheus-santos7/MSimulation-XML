import { createTaxModule } from "../../../tax/index.js";
import type { TaxRuleCatalogEntry } from "../../../tax/domain/entities/tax-rule-catalog-entry.entity.js";
import type { TaxRuleValidatorPort } from "../../domain/ports/tax-rule-validator.port.js";

export class TaxRuleValidatorAdapter implements TaxRuleValidatorPort {
  async listProductTaxRuleCatalog(tenantId: string): Promise<TaxRuleCatalogEntry[]> {
    return createTaxModule().getTaxRuleCatalog.execute(tenantId);
  }

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
