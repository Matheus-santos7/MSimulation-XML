import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import {
  normalizeTaxRuleDisplayName,
  taxRuleBaseIdFromRuleId,
  taxRuleOriginUf,
} from "../../../../lib/fiscal/tax-rule-ids.js";
import { TaxRuleError } from "../../domain/errors/tax-rule.error.js";
import type {
  ResolveTaxRuleParams,
  TaxRuleRepository,
} from "../../domain/ports/tax-rule.repository.js";
import { mapTaxRuleFromPrisma } from "./tax-rule-prisma.mapper.js";
import { resolveTaxRuleFromDb } from "./tax-rule-resolution.js";

type Db = PrismaClient | PrismaTx;

export class PrismaTaxRuleRepository implements TaxRuleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByTenant(tenantId: string) {
    const rows = await this.prisma.taxRule.findMany({
      where: { tenantId },
      orderBy: { ruleId: "asc" },
    });
    return rows.map(mapTaxRuleFromPrisma);
  }

  async listCatalogEntries(tenantId: string) {
    const [rows, tenant] = await Promise.all([
      this.prisma.taxRule.findMany({
        where: { tenantId, source: "xlsx" },
        select: { ruleId: true, nome: true, origin: true, uf: true },
        orderBy: { nome: "asc" },
      }),
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { uf: true } }),
    ]);

    const tenantOrigin = tenant?.uf.toUpperCase().slice(0, 2) ?? "";
    const map = new Map<string, { baseId: string; nome: string; origin: string; label: string }>();

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

  async bulkUpsert(tenantId: string, rows: Parameters<TaxRuleRepository["bulkUpsert"]>[1]) {
    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const existing = await this.prisma.taxRule.findUnique({
        where: { tenantId_ruleId: { tenantId, ruleId: row.ruleId } },
        select: { id: true },
      });

      await this.prisma.taxRule.upsert({
        where: { tenantId_ruleId: { tenantId, ruleId: row.ruleId } },
        create: {
          tenantId,
          ruleId: row.ruleId,
          nome: row.nome,
          tipo: row.tipo,
          uf: row.uf,
          cfop: row.cfop,
          aliquota: row.aliquota,
          transactionType: row.transactionType,
          customerType: row.customerType,
          origin: row.origin,
          source: "xlsx",
          payload: row.payload as Prisma.InputJsonValue | undefined,
        },
        update: {
          nome: row.nome,
          tipo: row.tipo,
          uf: row.uf,
          cfop: row.cfop,
          aliquota: row.aliquota,
          transactionType: row.transactionType,
          customerType: row.customerType,
          origin: row.origin,
          source: "xlsx",
          payload: row.payload as Prisma.InputJsonValue | undefined,
        },
      });

      if (existing) updated++;
      else created++;
    }

    return { created, updated, total: rows.length };
  }

  async deleteAll(tenantId: string) {
    const rulesCount = await this.prisma.taxRule.count({ where: { tenantId } });
    if (rulesCount === 0) {
      throw new TaxRuleError("Nenhuma regra cadastrada para esta empresa");
    }
    const result = await this.prisma.taxRule.deleteMany({ where: { tenantId } });
    return { deleted: result.count };
  }

  async deleteGroup(tenantId: string, baseId: string, origin: string) {
    const normalizedBase = baseId.trim();
    const normalizedOrigin = origin.toUpperCase().slice(0, 2);
    if (!normalizedBase) throw new TaxRuleError("Regra inválida");
    if (!normalizedOrigin) throw new TaxRuleError("Origem fiscal inválida");

    const productsUsing = await this.prisma.product.count({
      where: { tenantId, taxRuleBaseId: normalizedBase },
    });
    if (productsUsing > 0) {
      throw new TaxRuleError(
        `Não é possível excluir: ${productsUsing} produto(s) usam esta regra. Altere a regra fiscal deles antes.`,
      );
    }

    const rules = await this.prisma.taxRule.findMany({
      where: {
        tenantId,
        ruleId: { startsWith: `${normalizedBase}-` },
      },
      select: { id: true, nome: true, origin: true, uf: true, ruleId: true },
    });

    const toDelete = rules.filter((r) => taxRuleOriginUf(r) === normalizedOrigin);
    if (toDelete.length === 0) {
      throw new TaxRuleError("Regra não encontrada para esta origem");
    }

    await this.prisma.taxRule.deleteMany({
      where: { id: { in: toDelete.map((r) => r.id) } },
    });

    return {
      deleted: toDelete.length,
      nome: normalizeTaxRuleDisplayName(toDelete[0]!.nome),
    };
  }

  async assertProductBaseId(tenantId: string, taxRuleBaseId: string, tenantUf?: string) {
    const baseId = taxRuleBaseId.trim();
    if (!baseId) throw new TaxRuleError("Selecione a regra fiscal do produto");

    const tenantOrigin = tenantUf?.toUpperCase().slice(0, 2);
    const rows = await this.prisma.taxRule.findMany({
      where: {
        tenantId,
        ruleId: { startsWith: `${baseId}-` },
      },
      select: { origin: true, uf: true, ruleId: true },
    });

    if (rows.length === 0) {
      throw new TaxRuleError(
        `Regra fiscal "${baseId}" não encontrada. Importe a planilha em Regras tributárias.`,
      );
    }

    if (!tenantOrigin) return;

    const match = rows.find((row) => taxRuleOriginUf(row) === tenantOrigin);
    if (!match) {
      const available = [...new Set(rows.map((row) => taxRuleOriginUf(row)))].sort().join(", ");
      throw new TaxRuleError(
        `A regra "${baseId}" não possui linhas para origem ${tenantOrigin}. ` +
          `Origens disponíveis na planilha: ${available}. ` +
          `Importe regras com ORIGIN=${tenantOrigin} ou ajuste a UF da empresa.`,
      );
    }
  }

  async resolve(tenantId: string, params: ResolveTaxRuleParams, db?: unknown) {
    const client = (db ?? this.prisma) as Db;
    return resolveTaxRuleFromDb(client as PrismaTx, tenantId, params);
  }
}
