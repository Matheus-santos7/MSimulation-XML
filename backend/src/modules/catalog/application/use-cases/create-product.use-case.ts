import type { Product } from "../../domain/entities/product.entity.js";
import type { ProductRepository } from "../../domain/ports/product.repository.js";
import type { TaxRuleValidatorPort } from "../../domain/ports/tax-rule-validator.port.js";
import type { CreateProductCommand } from "../dto/create-product.command.js";

export class CreateProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly taxRuleValidator: TaxRuleValidatorPort,
  ) {}

  async execute(tenantId: string, command: CreateProductCommand): Promise<Product> {
    const stock = command.estoque ?? 0;
    const taxRuleBaseId = command.taxRuleBaseId?.trim();

    if (taxRuleBaseId) {
      const tenantUf = await this.productRepository.getTenantUf(tenantId);
      await this.taxRuleValidator.assertProductTaxRuleBaseId(tenantId, taxRuleBaseId, tenantUf);
    }

    return this.productRepository.create(tenantId, {
      sku: command.sku,
      ean: command.ean,
      nome: command.nome,
      ncm: command.ncm,
      cest: command.cest,
      exTipi: command.exTipi,
      origem: command.origem,
      unidade: command.unidade,
      preco: command.preco,
      precoCusto: command.precoCusto,
      estoque: stock,
      taxRuleBaseId,
    });
  }
}
