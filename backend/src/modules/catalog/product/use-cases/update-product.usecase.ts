import { Inject, Injectable } from "@nestjs/common";
import { TaxRuleService } from "../../../tax/index.js";
import { CatalogError } from "../../errors/catalog.errors.js";
import { ProductRepository } from "../product.repository.js";
import type { Product } from "../product.types.js";
import { resolveProductNfci } from "../rules/product-nfci.js";
import type { CreateProductCommand } from "../types/create-product.command.js";

export type UpdateProductCommand = Partial<CreateProductCommand>;

/**
 * Atualiza campos de um produto (PATCH parcial). Estoque omitido mantém o atual; a regra fiscal
 * só é validada quando enviada.
 *
 * @throws {TaxRuleCatalogError} Regra fiscal inválida
 * @throws {CatalogError.ProductConflict} SKU já cadastrado
 * @throws {CatalogError.ProductInvalid} nFCI inválido para a origem
 */
@Injectable()
export class UpdateProductUseCase {
  constructor(
    @Inject(ProductRepository) private readonly productRepository: ProductRepository,
    @Inject(TaxRuleService) private readonly taxRules: TaxRuleService,
  ) {}

  async execute(
    id: string,
    tenantId: string,
    command: UpdateProductCommand,
  ): Promise<Product | null> {
    const existing = await this.productRepository.findById(id, tenantId);
    if (!existing) return null;

    if (command.taxRuleBaseId) {
      const tenantUf = await this.productRepository.getTenantUf(existing.tenantId);
      await this.taxRules.assertProductTaxRuleBaseId(
        existing.tenantId,
        command.taxRuleBaseId,
        tenantUf,
      );
    }

    const origem = command.origem ?? existing.origem;
    const patch: UpdateProductCommand & { estoque: number } = {
      ...command,
      estoque: command.estoque ?? existing.estoque,
    };

    if (command.origem !== undefined || command.nfci !== undefined) {
      try {
        patch.nfci =
          resolveProductNfci(origem, command.nfci !== undefined ? command.nfci : existing.nfci) ??
          undefined;
      } catch (error) {
        throw new CatalogError.ProductInvalid(
          error instanceof Error ? error.message : "nFCI inválido",
        );
      }
      if (command.origem !== undefined) {
        patch.origem = origem;
      }
    }

    return this.productRepository.update(id, patch);
  }
}
