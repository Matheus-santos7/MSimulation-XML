import { Injectable } from "@nestjs/common";
import type { PrismaTx } from "../../../lib/db/prisma-tx.js";
import {
  normalizeTaxRuleDisplayName,
  taxRuleBaseIdFromRuleId,
  taxRuleOriginUf,
} from "./rules/tax-rule-ids.js";
import { TaxRuleError } from "../errors/tax.errors.js";
import type { TaxRuleImportRow } from "./types/tax-rule-import-row.types.js";
import type { ResolveTaxRuleParams } from "./types/tax-rule-query.types.js";
import { mapTaxRuleFromPrisma } from "./tax-rule.mapper.js";
import { resolveTaxRuleFromDb } from "./tax-rule-resolution.js";
import { getDbClient } from "../../../lib/db/tenant-rls.js";

/**
 * Linhas por `INSERT ... ON CONFLICT`. São 10 arrays por comando; 500 linhas mantém o comando
 * pequeno (bem abaixo do limite de parâmetros e de memória do servidor) e faz 3.000 linhas em
 * 6 comandos de INSERT (mais 1 findMany prévio). Aumentar ganha pouco; diminuir volta a pagar round-trip por lote.
 */
const UPSERT_BATCH_SIZE = 500;

/**
 * Regras fiscais do tenant: lista, catálogo agrupado por `baseId`, upsert em massa e resolução
 * (delegada a {@link resolveTaxRuleFromDb}).
 */
@Injectable()
export class TaxRuleRepository {
  private get db() {
    return getDbClient();
  }

  async listByTenant(tenantId: string) {
    const rows = await this.db.taxRule.findMany({
      where: { tenantId },
      orderBy: { ruleId: "asc" },
    });
    return rows.map(mapTaxRuleFromPrisma);
  }

  async listCatalogEntries(tenantId: string) {
    const [rows, tenant] = await Promise.all([
      this.db.taxRule.findMany({
        where: { tenantId, source: "xlsx" },
        select: { ruleId: true, nome: true, origin: true, uf: true },
        orderBy: { nome: "asc" },
      }),
      this.db.tenant.findUnique({ where: { id: tenantId }, select: { uf: true } }),
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

  /**
   * Grava as regras importadas com poucas consultas: 1 `findMany` dos `ruleId` já existentes
   * (para contar criadas x atualizadas) e 1 `INSERT ... ON CONFLICT` por lote de
   * {@link UPSERT_BATCH_SIZE} linhas.
   *
   * Por que em lote: a importação roda dentro da transação aberta pelo chamador
   * (`runWithDbContext`), e uma transação usa uma
   * conexão só, então o `Promise.all` de vários `upsert` virava fila sequencial: com
   * ~50-100 ms de round-trip no Neon, 3.000 linhas levavam minutos e estouravam o timeout.
   *
   * Linhas com o mesmo `ruleId` são deduplicadas e a última vence (mesmo resultado do upsert
   * linha a linha). Além disso, o Postgres recusa um `ON CONFLICT DO UPDATE` que atinja a
   * mesma linha duas vezes no mesmo comando. `total` conta as linhas gravadas após deduplicar.
   *
   * Na planilha, o mapper já rejeita duplicatas (a PRIMEIRA ocorrência vence e a repetição vira
   * erro de linha); esta deduplicação (a ÚLTIMA vence) cobre a rota JSON
   * `POST /tax-rules/bulk-upsert`, onde `total` também conta só linhas únicas.
   */
  async bulkUpsert(tenantId: string, rows: TaxRuleImportRow[]) {
    const uniqueRows = [...new Map(rows.map((row) => [row.ruleId, row])).values()];
    const existingRows = await this.db.taxRule.findMany({
      where: { tenantId, ruleId: { in: uniqueRows.map((row) => row.ruleId) } },
      select: { ruleId: true },
    });
    const knownRuleIds = new Set(existingRows.map((existing) => existing.ruleId));

    for (let i = 0; i < uniqueRows.length; i += UPSERT_BATCH_SIZE) {
      await this.upsertBatch(tenantId, uniqueRows.slice(i, i + UPSERT_BATCH_SIZE));
    }

    const updated = uniqueRows.filter((row) => knownRuleIds.has(row.ruleId)).length;

    return { created: uniqueRows.length - updated, updated, total: uniqueRows.length };
  }

  /**
   * SQL cru acoplado ao schema de `tax_rules`. Se uma coluna entrar, sair ou mudar de tipo no
   * `schema.prisma`, atualize esta consulta junto (lista do INSERT, `unnest`, `DO UPDATE`).
   * O Prisma não valida SQL cru: coluna NOT NULL esquecida só falha em tempo de execução.
   *
   * - `id` não tem default no banco (o `uuid()` do Prisma roda no client), por isso `gen_random_uuid()`.
   * - `created_at`/`updated_at` são `timestamp` sem fuso que o Prisma grava em UTC; `timezone('UTC',
   *   now())` mantém o mesmo valor qualquer que seja a `TimeZone` da sessão.
   * - As colunas opcionais usam `COALESCE` no UPDATE: o `upsert` antigo ignorava campo
   *   `undefined`, mantendo o valor gravado; aqui `undefined` vira NULL e o COALESCE preserva.
   * - Roda no `getDbClient()` da request: a política RLS do tenant vale para este comando.
   */
  private async upsertBatch(tenantId: string, rows: TaxRuleImportRow[]) {
    const column = <T>(pick: (row: TaxRuleImportRow) => T | undefined) =>
      rows.map((row) => pick(row) ?? null);

    await this.db.$executeRaw`
      INSERT INTO "tax_rules" (
        "id", "tenant_id", "rule_id", "nome", "tipo", "uf", "cfop", "aliquota",
        "transaction_type", "customer_type", "origin", "source", "payload",
        "created_at", "updated_at"
      )
      SELECT
        gen_random_uuid()::text, ${tenantId}::text, r.rule_id, r.nome, r.tipo, r.uf, r.cfop,
        r.aliquota, r.transaction_type, r.customer_type, r.origin, 'xlsx', r.payload::jsonb,
        timezone('UTC', now()), timezone('UTC', now())
      FROM unnest(
        ${column((row) => row.ruleId)}::text[],
        ${column((row) => row.nome)}::text[],
        ${column((row) => row.tipo)}::text[],
        ${column((row) => row.uf)}::text[],
        ${column((row) => row.cfop)}::text[],
        ${column((row) => row.aliquota)}::text[],
        ${column((row) => row.transactionType)}::text[],
        ${column((row) => row.customerType)}::text[],
        ${column((row) => row.origin)}::text[],
        ${column((row) => (row.payload === undefined ? undefined : JSON.stringify(row.payload)))}::text[]
      ) AS r(
        rule_id, nome, tipo, uf, cfop, aliquota, transaction_type, customer_type, origin, payload
      )
      ON CONFLICT ("tenant_id", "rule_id") DO UPDATE SET
        "nome" = EXCLUDED."nome",
        "tipo" = EXCLUDED."tipo",
        "uf" = EXCLUDED."uf",
        "cfop" = EXCLUDED."cfop",
        "aliquota" = EXCLUDED."aliquota",
        "transaction_type" = COALESCE(EXCLUDED."transaction_type", "tax_rules"."transaction_type"),
        "customer_type" = COALESCE(EXCLUDED."customer_type", "tax_rules"."customer_type"),
        "origin" = COALESCE(EXCLUDED."origin", "tax_rules"."origin"),
        "source" = EXCLUDED."source",
        "payload" = COALESCE(EXCLUDED."payload", "tax_rules"."payload"),
        "updated_at" = timezone('UTC', now())
    `;
  }

  async deleteAll(tenantId: string) {
    const rulesCount = await this.db.taxRule.count({ where: { tenantId } });
    if (rulesCount === 0) {
      throw new TaxRuleError("Nenhuma regra cadastrada para esta empresa");
    }
    const result = await this.db.taxRule.deleteMany({ where: { tenantId } });
    return { deleted: result.count };
  }

  async assertProductBaseId(tenantId: string, taxRuleBaseId: string, tenantUf?: string) {
    const baseId = taxRuleBaseId.trim();
    if (!baseId) throw new TaxRuleError("Selecione a regra fiscal do produto");

    const tenantOrigin = tenantUf?.toUpperCase().slice(0, 2);
    const rows = await this.db.taxRule.findMany({
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

  async resolve(tenantId: string, params: ResolveTaxRuleParams, db?: PrismaTx) {
    return resolveTaxRuleFromDb(db ?? this.db, tenantId, params);
  }
}
