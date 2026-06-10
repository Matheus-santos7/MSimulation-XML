import type { PrismaClient } from "../../../generated/prisma/client.js";
import {
  normalizeTaxRuleDisplayName,
  taxRuleBaseIdFromRuleId,
  taxRuleOriginUf,
} from "../../../lib/fiscal/tax-rule-ids.js";

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
  const [rows, tenant] = await Promise.all([
    prisma.taxRule.findMany({
      where: { tenantId, source: "xlsx" },
      select: { ruleId: true, nome: true, origin: true, uf: true },
      orderBy: { nome: "asc" },
    }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { uf: true } }),
  ]);

  const tenantOrigin = tenant?.uf.toUpperCase().slice(0, 2) ?? "";

  const map = new Map<string, TaxRuleCatalogEntry>();
  for (const row of rows) {
    const baseId = taxRuleBaseIdFromRuleId(row.ruleId);
    const origin = taxRuleOriginUf(row);
    if (tenantOrigin && origin !== tenantOrigin) continue;

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

  const tenantOrigin = tenantUf?.toUpperCase().slice(0, 2);
  const rows = await prisma.taxRule.findMany({
    where: {
      tenantId,
      ruleId: { startsWith: `${baseId}-` },
    },
    select: { origin: true, uf: true, ruleId: true },
  });

  if (rows.length === 0) {
    throw new TaxRuleCatalogError(
      `Regra fiscal "${baseId}" não encontrada. Importe a planilha em Regras tributárias.`,
    );
  }

  if (!tenantOrigin) return;

  const match = rows.find((row) => taxRuleOriginUf(row) === tenantOrigin);
  if (!match) {
    const available = [...new Set(rows.map((row) => taxRuleOriginUf(row)))].sort().join(", ");
    throw new TaxRuleCatalogError(
      `A regra "${baseId}" não possui linhas para origem ${tenantOrigin}. ` +
        `Origens disponíveis na planilha: ${available}. ` +
        `Importe regras com ORIGIN=${tenantOrigin} ou ajuste a UF da empresa.`,
    );
  }
}

export async function deleteAllTaxRules(
  prisma: PrismaClient,
  tenantId: string,
): Promise<{ deleted: number }> {
  const rulesCount = await prisma.taxRule.count({ where: { tenantId } });
  if (rulesCount === 0) {
    throw new TaxRuleCatalogError("Nenhuma regra cadastrada para esta empresa");
  }

  const result = await prisma.taxRule.deleteMany({ where: { tenantId } });
  return { deleted: result.count };
}

export async function deleteTaxRuleGroup(
  prisma: PrismaClient,
  tenantId: string,
  baseId: string,
  origin: string,
): Promise<{ deleted: number; nome: string }> {
  const normalizedBase = baseId.trim();
  const normalizedOrigin = origin.toUpperCase().slice(0, 2);
  if (!normalizedBase) throw new TaxRuleCatalogError("Regra inválida");
  if (!normalizedOrigin) throw new TaxRuleCatalogError("Origem fiscal inválida");

  const productsUsing = await prisma.product.count({
    where: { tenantId, taxRuleBaseId: normalizedBase },
  });
  if (productsUsing > 0) {
    throw new TaxRuleCatalogError(
      `Não é possível excluir: ${productsUsing} produto(s) usam esta regra. Altere a regra fiscal deles antes.`,
    );
  }

  const rules = await prisma.taxRule.findMany({
    where: {
      tenantId,
      ruleId: { startsWith: `${normalizedBase}-` },
    },
    select: { id: true, nome: true, origin: true, uf: true, ruleId: true },
  });

  const toDelete = rules.filter((r) => taxRuleOriginUf(r) === normalizedOrigin);
  if (toDelete.length === 0) {
    throw new TaxRuleCatalogError("Regra não encontrada para esta origem");
  }

  await prisma.taxRule.deleteMany({
    where: { id: { in: toDelete.map((r) => r.id) } },
  });

  return {
    deleted: toDelete.length,
    nome: normalizeTaxRuleDisplayName(toDelete[0]!.nome),
  };
}

export class TaxRuleCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaxRuleCatalogError";
  }
}
