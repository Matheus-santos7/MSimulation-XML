import { ProductConflictError } from "../../domain/errors/product-conflict.error.js";
import { ProductValidationError } from "../../domain/errors/product-validation.error.js";
import type { ProductRepository } from "../../domain/ports/product.repository.js";
import type { TaxRuleValidatorPort } from "../../domain/ports/tax-rule-validator.port.js";
import { resolveProductNfci } from "../../domain/services/product-nfci.js";
import { dedupeBulkRowsBySku } from "../../domain/services/dedupe-bulk-rows-by-sku.service.js";
import type {
  BulkUpsertProductsCommand,
  BulkUpsertProductsResult,
} from "../dto/bulk-upsert-products.command.js";
import type { CreateProductCommand } from "../dto/create-product.command.js";
import { validateProductImportRow } from "../services/validate-product-import-row.service.js";

/**
 * Importação em massa (bulk upsert): cria ou atualiza produtos por SKU.
 *
 * Fluxo:
 * 1. Valida cada linha bruta (NCM, CEST, preços, etc.)
 * 2. Deduplica por SKU (última ocorrência vence) com avisos
 * 3. Carrega índice SKU existente numa única query
 * 4. Por linha válida: valida regra fiscal → update se SKU existe, senão create
 * 5. Falhas por linha são capturadas; o lote continua (resposta parcial)
 */
export class BulkUpsertProductsUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly taxRuleValidator: TaxRuleValidatorPort,
  ) {}

  async execute(command: BulkUpsertProductsCommand): Promise<BulkUpsertProductsResult> {
    const { tenantId, rows } = command;
    const tenantUf = await this.productRepository.getTenantUf(tenantId);

    const parseErrors: BulkUpsertProductsResult["parseErrors"] = [];
    const validRows: { row: CreateProductCommand; line: number }[] = [];

    for (const raw of rows) {
      const validation = validateProductImportRow(raw);
      if (!validation.ok) {
        parseErrors.push({ line: raw.line, message: validation.message });
        continue;
      }
      validRows.push({ row: validation.row, line: raw.line });
    }

    if (validRows.length === 0) {
      throw new ProductValidationError(
        parseErrors[0]?.message ?? "Nenhum produto válido na planilha",
      );
    }

    const { rows: dedupedRows, warnings } = dedupeBulkRowsBySku(validRows);
    if (warnings.length > 0) {
      parseErrors.push(...warnings);
    }

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

        const resolvedNfci = resolveProductNfci(row.origem, row.nfci) ?? null;

        if (existing) {
          await this.productRepository.update(existing.id, {
            ean: row.ean,
            nome: row.nome,
            ncm: row.ncm,
            cest: row.cest ?? null,
            exTipi: row.exTipi,
            origem: row.origem,
            nfci: resolvedNfci,
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
            cest: row.cest ?? null,
            exTipi: row.exTipi,
            origem: row.origem,
            nfci: resolvedNfci,
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

    return {
      created,
      updated,
      failed,
      parseErrors: parseErrors.length > 0 ? parseErrors : undefined,
      total: dedupedRows.length,
    };
  }
}

/** Normaliza mensagens de erro por linha para resposta HTTP legível. */
function mapBulkRowErrorMessage(error: unknown): string {
  if (error instanceof ProductConflictError) return error.message;
  if (error instanceof ProductValidationError) return error.message;
  if (error instanceof Error) {
    if (error.name === "TaxRuleCatalogError") return error.message;
    if (/Unique constraint failed/i.test(error.message)) return "SKU já cadastrado nesta empresa";
    return error.message;
  }
  return "Erro ao salvar linha";
}
