import { Inject, Injectable } from "@nestjs/common";
import { resolveTaxRuleRefFromCatalog, TaxRuleService } from "../../../tax/index.js";
import { CatalogError } from "../../errors/catalog.errors.js";
import { ProductRepository } from "../../product/product.repository.js";
import { resolveProductNfci } from "../../product/rules/product-nfci.js";
import { dedupeBulkRowsBySku } from "../rules/dedupe-bulk-rows-by-sku.js";
import type {
  BulkUpsertProductsCommand,
  BulkUpsertProductsResult,
} from "../product-import.types.js";
import type { CreateProductCommand } from "../../product/types/create-product.command.js";
import { validateProductImportRow } from "../rules/validate-product-import-row.js";

/**
 * Importação em massa (bulk upsert): cria ou atualiza produtos por SKU.
 *
 * Fluxo:
 * 1. Valida cada linha bruta (NCM, CEST, preços, etc.)
 * 2. Deduplica por SKU (última ocorrência vence) com avisos
 * 3. Carrega índice SKU existente numa única query
 * 4. Por linha válida: resolve nome/código da regra → valida → update se SKU existe, senão create
 * 5. Falha de validação da linha (antes de gravar) entra em `failed` e o lote continua. Erro do
 *    banco aborta a transação do Postgres: o import inteiro falha (CAT-1), em vez de responder
 *    `created` para linhas que o rollback desfaz.
 */
@Injectable()
export class BulkUpsertProductsUseCase {
  constructor(
    @Inject(ProductRepository) private readonly productRepository: ProductRepository,
    @Inject(TaxRuleService) private readonly taxRules: TaxRuleService,
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
      throw new CatalogError.ProductInvalid(
        parseErrors[0]?.message ?? "Nenhum produto válido na planilha",
      );
    }

    const { rows: dedupedRows, warnings } = dedupeBulkRowsBySku(validRows);
    if (warnings.length > 0) {
      parseErrors.push(...warnings);
    }

    const skuIndex = await this.productRepository.listSkuIndex(tenantId);
    const taxRuleCatalog = await this.taxRules.catalog(tenantId);

    let created = 0;
    let updated = 0;
    const failed: BulkUpsertProductsResult["failed"] = [];

    for (const { row, line } of dedupedRows) {
      const existing = skuIndex.get(row.sku);
      const stock = row.estoque ?? 0;
      const taxRuleRef = row.taxRuleBaseId?.trim();

      try {
        let taxRuleBaseId: string | undefined;
        if (taxRuleRef) {
          const resolved = resolveTaxRuleRefFromCatalog(taxRuleRef, taxRuleCatalog);
          if (!resolved.ok) {
            throw new CatalogError.ProductInvalid(resolved.message);
          }
          taxRuleBaseId = resolved.baseId;
          await this.taxRules.assertProductTaxRuleBaseId(tenantId, taxRuleBaseId, tenantUf);
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
        if (!isRowValidationError(error)) throw error;
        failed.push({ line, sku: row.sku, error: error.message });
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

/** Erros lançados antes de qualquer escrita: não abortam a transação e a linha pode ser pulada. */
function isRowValidationError(error: unknown): error is Error {
  return (
    error instanceof CatalogError.ProductInvalid ||
    (error instanceof Error && error.name === "TaxRuleCatalogError")
  );
}
