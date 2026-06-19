import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import { fiscalNotDeleted } from "../../domain/constants/fiscal-not-deleted.js";
import { listTimelineChains } from "./timeline-service.js";
import {
  buildTimelineSpreadsheetXlsx,
  type TimelineNfeExportDetail,
} from "./timeline-spreadsheet.export.js";

/**
 * Resolve o SKU exibido na coluna PRODUTO da planilha.
 * Prioriza produto do cabeçalho da NF-e; fallback no primeiro item.
 *
 * @param product - Produto vinculado diretamente à NF-e.
 * @param itemProduct - Produto do primeiro `nfe_item`, quando existir.
 * @returns SKU trimado ou string vazia.
 */
function resolveProdutoSku(
  product?: { sku: string } | null,
  itemProduct?: { sku: string } | null,
): string {
  const picked = product ?? itemProduct;
  return picked?.sku?.trim() ?? "";
}

/**
 * Carrega metadados fiscais das NF-e do tenant indexados por chave de acesso.
 * Usado exclusivamente para preencher colunas da planilha de cenários.
 *
 * @param db - Cliente Prisma ou transação.
 * @param tenantId - Tenant emissor.
 * @returns Mapa chave → CFOP, UF destino, chave referência e SKU.
 */
async function loadNfeExportDetails(
  db: DbClient,
  tenantId: string,
): Promise<Map<string, TimelineNfeExportDetail>> {
  const rows = await db.nFe.findMany({
    where: { tenantId, ...fiscalNotDeleted },
    select: {
      chave: true,
      cfop: true,
      destUf: true,
      nfeReferencia: { select: { chave: true } },
      product: { select: { sku: true } },
      itens: {
        take: 1,
        orderBy: { numeroItem: "asc" },
        select: { product: { select: { sku: true } } },
      },
    },
  });

  return new Map(
    rows.map((row) => [
      row.chave,
      {
        cfop: row.cfop,
        destUf: row.destUf,
        nfeReferenciaChave: row.nfeReferencia?.chave,
        produto: resolveProdutoSku(row.product, row.itens[0]?.product),
      },
    ]),
  );
}

/**
 * Caso de uso: exporta todos os cenários fiscais do tenant em planilha XLSX.
 *
 * Combina a timeline enriquecida (`listTimelineChains`), UF do emitente e
 * detalhes fiscais das NF-e para gerar `cenarios-fiscais.xlsx`.
 *
 * @param db - Cliente Prisma.
 * @param tenantId - Tenant autenticado.
 * @returns Buffer do arquivo `.xlsx` pronto para download HTTP.
 * @throws Erro Prisma se o tenant não existir.
 */
export async function exportTimelineSpreadsheet(db: DbClient, tenantId: string): Promise<Buffer> {
  const [groups, tenant, nfeDetails] = await Promise.all([
    listTimelineChains(db, tenantId),
    db.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { uf: true },
    }),
    loadNfeExportDetails(db, tenantId),
  ]);

  return buildTimelineSpreadsheetXlsx(groups, tenant.uf, nfeDetails);
}
