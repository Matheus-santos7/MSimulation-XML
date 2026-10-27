import { Inject, Injectable } from "@nestjs/common";
import { TaxRuleService } from "../../../tax/index.js";
import { CatalogError } from "../../errors/catalog.errors.js";
import { ProductRepository } from "../product.repository.js";
import type { Product } from "../product.types.js";
import { resolveProductNfci } from "../rules/product-nfci.js";
import type { CreateProductCommand } from "../types/create-product.command.js";

/**
 * Cria produto no catálogo da empresa. Valida a regra fiscal vinculada (módulo tax) antes de
 * gravar; estoque padrão é 0.
 *
 * @throws {TaxRuleCatalogError} Regra fiscal inválida para a UF da empresa
 * @throws {CatalogError.ProductConflict} SKU já cadastrado
 * @throws {CatalogError.ProductInvalid} nFCI inválido para a origem
 */
@Injectable()
export class CreateProductUseCase {
  constructor(
    @Inject(ProductRepository) private readonly productRepository: ProductRepository,
    @Inject(TaxRuleService) private readonly taxRules: TaxRuleService,
  ) {}

  async execute(tenantId: string, command: CreateProductCommand): Promise<Product> {
    const taxRuleBaseId = command.taxRuleBaseId?.trim();
    if (taxRuleBaseId) {
      const tenantUf = await this.productRepository.getTenantUf(tenantId);
      await this.taxRules.assertProductTaxRuleBaseId(tenantId, taxRuleBaseId, tenantUf);
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
      estoque: command.estoque ?? 0,
      sujeitoSt: command.sujeitoSt === true,
      taxRuleBaseId,
    });
  }
}

function resolveProductNfciOrThrow(origem: number, nfci?: string | null): string | undefined {
  try {
    return resolveProductNfci(origem, nfci);
  } catch (error) {
    throw new CatalogError.ProductInvalid(error instanceof Error ? error.message : "nFCI inválido");
  }
}
