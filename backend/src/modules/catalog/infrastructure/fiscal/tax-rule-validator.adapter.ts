import type { PrismaClient } from "../../../../generated/prisma/client.js";
import { createTaxModule } from "../../../tax/index.js";
import type { TaxRuleValidatorPort } from "../../domain/ports/tax-rule-validator.port.js";

export class TaxRuleValidatorAdapter implements TaxRuleValidatorPort {
  constructor(private readonly prisma: PrismaClient) {}

  async assertProductTaxRuleBaseId(
    tenantId: string,
    taxRuleBaseId: string,
    tenantUf: string,
  ): Promise<void> {
    await createTaxModule(this.prisma).assertProductTaxRuleBaseId.execute(
      tenantId,
      taxRuleBaseId,
      tenantUf,
    );
  }
}
