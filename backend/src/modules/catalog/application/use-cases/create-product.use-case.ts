import type { Product } from "../../domain/entities/product.entity.js";
import { ProductValidationError } from "../../domain/errors/product-validation.error.js";
import type { ProductRepository } from "../../domain/ports/product.repository.js";
import type { TaxRuleValidatorPort } from "../../domain/ports/tax-rule-validator.port.js";
import { resolveProductNfci } from "../../domain/services/product-nfci.js";
import type { CreateProductCommand } from "../dto/create-product.command.js";

/**
 * Cria um produto no catálogo do tenant.
 *
 * Valida `taxRuleBaseId` contra o módulo tax (quando informado) antes de persistir.
 * Estoque padrão é `0` se omitido.
 *
 * @param tenantId - Tenant emitente (extraído do JWT)
 * @param command - Dados fiscais e comerciais do produto
 * @returns Produto criado
 * @throws {TaxRuleCatalogError} Regra fiscal inválida para a UF do tenant
 * @throws {ProductConflictError} SKU já existente no tenant
 */
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
      nfci: resolveProductNfciOrThrow(command.origem, command.nfci),
      unidade: command.unidade,
      preco: command.preco,
      precoCusto: command.precoCusto,
      estoque: stock,
      taxRuleBaseId,
    });
  }
}

function resolveProductNfciOrThrow(origem: number, nfci?: string | null): string | undefined {
  try {
    return resolveProductNfci(origem, nfci);
  } catch (error) {
    throw new ProductValidationError(error instanceof Error ? error.message : "nFCI inválido");
  }
}
