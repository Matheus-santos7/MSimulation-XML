import type { PrismaClient } from "../generated/prisma/client.js";
import { normalizeTaxRuleDisplayName, taxRuleBaseIdFromRuleId } from "../lib/tax-rule-ids.js";

export type TaxRuleCatalogEntry = {
  baseId: string;
  nome: string;
  origin: string;
  label: string;
};

export async function listTaxRuleCatalog(
  prisma: PrismaClient,
  tenantId: string,
): Promise<TaxRuleCatalogEntry[]> {
  const rows = await prisma.taxRule.findMany({
    where: { tenantId, source: "xlsx" },
    select: { ruleId: true, nome: true, origin: true, uf: true },
    orderBy: { nome: "asc" },
  });

  const map = new Map<string, TaxRuleCatalogEntry>();
  for (const row of rows) {
    const baseId = taxRuleBaseIdFromRuleId(row.ruleId);
    const origin = (row.origin ?? row.uf).toUpperCase().slice(0, 2);
    const key = `${baseId}::${origin}`;
    if (map.has(key)) continue;
    const nome = normalizeTaxRuleDisplayName(row.nome);
    map.set(key, {
      baseId,
      nome,
      origin,
      label: `${nome} · origem ${origin}`,
    });
  }

  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

export async function assertProductTaxRuleBaseId(
  prisma: PrismaClient,
  tenantId: string,
  taxRuleBaseId: string,
  tenantUf?: string,
): Promise<void> {
  const baseId = taxRuleBaseId.trim();
  if (!baseId) throw new TaxRuleCatalogError("Selecione a regra fiscal do produto");

  const row = await prisma.taxRule.findFirst({
    where: { tenantId, ruleId: { startsWith: `${baseId}-` } },
    select: { origin: true, uf: true },
  });
  if (!row) {
    throw new TaxRuleCatalogError(
      `Regra fiscal "${baseId}" não encontrada. Importe a planilha em Regras tributárias.`,
    );
  }

  if (tenantUf) {
    const ruleOrigin = (row.origin ?? row.uf).toUpperCase().slice(0, 2);
    if (ruleOrigin !== tenantUf.toUpperCase().slice(0, 2)) {
      throw new TaxRuleCatalogError(
        `A regra "${baseId}" é de origem ${ruleOrigin}, mas a empresa emite em ${tenantUf.toUpperCase().slice(0, 2)}.`,
      );
    }
  }
}

export class TaxRuleCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaxRuleCatalogError";
  }
}
