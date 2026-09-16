import type { TaxRuleCatalogEntry } from "../entities/tax-rule-catalog-entry.entity.js";
import { normalizeTaxRuleDisplayName } from "./tax-rule-ids.js";

export type ResolveTaxRuleRefResult =
  | { ok: true; baseId: string }
  | { ok: false; message: string };

function foldTaxRuleRef(value: string): string {
  return normalizeTaxRuleDisplayName(value)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Resolve valor da planilha de produtos (`Chuveiro` ou `baseId`) para `taxRuleBaseId`.
 *
 * Catálogo deve estar pré-filtrado pela UF do tenant (`listCatalogEntries`).
 * Igualdade no nome normalizado — não usa contains.
 */
export function resolveTaxRuleRefFromCatalog(
  raw: string,
  catalog: Pick<TaxRuleCatalogEntry, "baseId" | "nome">[],
): ResolveTaxRuleRefResult {
  const cell = foldTaxRuleRef(raw);
  if (!cell) {
    return { ok: false, message: "Selecione a regra fiscal do produto" };
  }

  const byBaseId = [
    ...new Set(
      catalog.filter((entry) => foldTaxRuleRef(entry.baseId) === cell).map((entry) => entry.baseId),
    ),
  ];
  if (byBaseId.length === 1) return { ok: true, baseId: byBaseId[0]! };
  if (byBaseId.length > 1) {
    return {
      ok: false,
      message: `A regra "${raw.trim()}" é ambígua (${byBaseId.length} códigos). Use o código da família (tax_rule_base_id).`,
    };
  }

  const byName = [
    ...new Set(
      catalog.filter((entry) => foldTaxRuleRef(entry.nome) === cell).map((entry) => entry.baseId),
    ),
  ];
  if (byName.length === 1) return { ok: true, baseId: byName[0]! };
  if (byName.length > 1) {
    return {
      ok: false,
      message:
        `A regra "${normalizeTaxRuleDisplayName(raw)}" é ambígua (${byName.length} famílias). ` +
        `Use o código da família (tax_rule_base_id), não o nome.`,
    };
  }

  return {
    ok: false,
    message:
      `Regra fiscal "${raw.trim()}" não encontrada. ` +
      `Use o nome completo da família (ex.: "Torneira 84818019 – Nacional") ou o código da regra.`,
  };
}
