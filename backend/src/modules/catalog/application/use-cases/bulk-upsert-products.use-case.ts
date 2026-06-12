import { ProductConflictError } from "../../domain/errors/product-conflict.error.js";
import type { ProductRepository } from "../../domain/ports/product.repository.js";
import type { TaxRuleValidatorPort } from "../../domain/ports/tax-rule-validator.port.js";
import { dedupeBulkRowsBySku } from "../../domain/services/dedupe-bulk-rows-by-sku.service.js";
import type {
  BulkUpsertProductsCommand,
  BulkUpsertProductsResult,
} from "../dto/bulk-upsert-products.command.js";

/**
 * Importação em massa (bulk upsert): cria ou atualiza produtos por SKU.
 *
 * Fluxo:
 * 1. Deduplica linhas repetidas (última ocorrência do SKU vence)
 * 2. Carrega índice SKU existente numa única query
 * 3. Por linha: valida regra fiscal → update se SKU existe, senão create
 * 4. Falhas por linha são capturadas; o lote continua (resposta parcial)
 *
 * @param command - `tenantId` e array `rows` do payload HTTP
 * @returns Contadores `created`, `updated`, `failed` e `total` pós-dedupe
 */
export class BulkUpsertProductsUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly taxRuleValidator: TaxRuleValidatorPort,
  ) {}

  async execute(command: BulkUpsertProductsCommand): Promise<BulkUpsertProductsResult> {
    const { tenantId, rows } = command;
    const tenantUf = await this.productRepository.getTenantUf(tenantId);
    const dedupedRows = dedupeBulkRowsBySku(rows);
    const skuIndex = await this.productRepository.listSkuIndex(tenantId);

    let created = 0;
    let updated = 0;
    const failed: BulkUpsertProductsResult["failed"] = [];

    for (const { row, line } of dedupedRows) {
      const existing = skuIndex.get(row.sku);
      const stock = row.estoque ?? 0;
      const taxRuleBaseId = row.taxRuleBaseId?.trim();

      try {
        if (taxRuleBaseId) {
          await this.taxRuleValidator.assertProductTaxRuleBaseId(tenantId, taxRuleBaseId, tenantUf);
        }

        if (existing) {
          await this.productRepository.update(existing.id, {
            ean: row.ean,
            nome: row.nome,
            ncm: row.ncm,
            cest: row.cest,
            exTipi: row.exTipi,
            origem: row.origem,
            unidade: row.unidade,
            preco: row.preco,
            precoCusto: row.precoCusto,
            estoque: stock,
            ...(taxRuleBaseId ? { taxRuleBaseId } : {}),
          });
          skuIndex.set(row.sku, { id: existing.id, estoque: stock });
          updated++;
        } else {
          const createdProduct = await this.productRepository.create(tenantId, {
            sku: row.sku,
            ean: row.ean,
            nome: row.nome,
            ncm: row.ncm,
            cest: row.cest,
            exTipi: row.exTipi,
            origem: row.origem,
            unidade: row.unidade,
            preco: row.preco,
            precoCusto: row.precoCusto,
            estoque: stock,
            taxRuleBaseId,
          });
          skuIndex.set(row.sku, { id: createdProduct.id, estoque: stock });
          created++;
        }
      } catch (error) {
        failed.push({
          line,
          sku: row.sku,
          error: mapBulkRowErrorMessage(error),
        });
      }
    }

    return { created, updated, failed, total: dedupedRows.length };
  }
}

/** Normaliza mensagens de erro por linha para resposta HTTP legível. */
function mapBulkRowErrorMessage(error: unknown): string {
  if (error instanceof ProductConflictError) return error.message;
  if (error instanceof Error) {
    if (error.name === "TaxRuleCatalogError") return error.message;
    if (/Unique constraint failed/i.test(error.message)) return "SKU já cadastrado nesta empresa";
    return error.message;
  }
  return "Erro ao salvar linha";
}
