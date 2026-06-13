import type { Product } from "../../domain/entities/product.entity.js";
import { ProductValidationError } from "../../domain/errors/product-validation.error.js";
import type { ProductRepository } from "../../domain/ports/product.repository.js";
import type { TaxRuleValidatorPort } from "../../domain/ports/tax-rule-validator.port.js";
import { resolveProductNfci } from "../../domain/services/product-nfci.js";
import type { UpdateProductCommand } from "../dto/update-product.command.js";

/**
 * Atualiza campos de um produto existente (PATCH parcial).
 *
 * Mescla estoque: se omitido no comando, mantém o valor atual.
 * Valida nova `taxRuleBaseId` apenas quando enviada no payload.
 *
 * @param id - UUID do produto
 * @param tenantId - Tenant do utilizador autenticado
 * @param command - Campos a alterar
 * @returns Produto atualizado ou `null` se não existir neste tenant
 * @throws {TaxRuleCatalogError} Regra fiscal inválida
 * @throws {ProductConflictError} Conflito de SKU
 */
export class UpdateProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly taxRuleValidator: TaxRuleValidatorPort,
  ) {}

  async execute(id: string, tenantId: string, command: UpdateProductCommand): Promise<Product | null> {
    const existing = await this.productRepository.findById(id, tenantId);
    if (!existing) return null;

    if (command.taxRuleBaseId) {
      const tenantUf = await this.productRepository.getTenantUf(existing.tenantId);
      await this.taxRuleValidator.assertProductTaxRuleBaseId(
        existing.tenantId,
        command.taxRuleBaseId,
        tenantUf,
      );
    }

    const mergedStock = command.estoque ?? existing.estoque;
    const origem = command.origem ?? existing.origem;
    const patch: UpdateProductCommand & { estoque: number } = {
      ...command,
      estoque: mergedStock,
    };

    if (command.origem !== undefined || command.nfci !== undefined) {
      try {
        patch.nfci =
          resolveProductNfci(
            origem,
            command.nfci !== undefined ? command.nfci : existing.nfci,
          ) ?? undefined;
      } catch (error) {
        throw new ProductValidationError(error instanceof Error ? error.message : "nFCI inválido");
      }
      if (command.origem !== undefined) {
        patch.origem = origem;
      }
    }

    return this.productRepository.update(id, patch);
  }
}
