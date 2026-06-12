import type { ResolvedTaxRule } from "../entities/resolved-tax-rule.entity.js";
import type { TaxRuleCatalogEntry } from "../entities/tax-rule-catalog-entry.entity.js";
import type { TaxRuleImportRow } from "../entities/tax-rule-import-row.entity.js";
import type { TaxRule } from "../entities/tax-rule.entity.js";
import type { CustomerType, TransactionType } from "../entities/tax-types.entity.js";

export type ResolveTaxRuleParams = {
  originUf: string;
  destinationUf: string;
  transactionType: TransactionType;
  customerType: CustomerType;
  ruleBaseId?: string;
};

export type BulkUpsertTaxRulesResult = {
  created: number;
  updated: number;
  total: number;
};

export interface TaxRuleRepository {
  listByTenant(tenantId: string): Promise<TaxRule[]>;
  listCatalogEntries(tenantId: string): Promise<TaxRuleCatalogEntry[]>;
  bulkUpsert(tenantId: string, rows: TaxRuleImportRow[]): Promise<BulkUpsertTaxRulesResult>;
  deleteAll(tenantId: string): Promise<{ deleted: number }>;
  deleteGroup(
    tenantId: string,
    baseId: string,
    origin: string,
  ): Promise<{ deleted: number; nome: string }>;
  assertProductBaseId(tenantId: string, taxRuleBaseId: string, tenantUf?: string): Promise<void>;
  resolve(
    tenantId: string,
    params: ResolveTaxRuleParams,
    db?: unknown,
  ): Promise<ResolvedTaxRule | null>;
}
