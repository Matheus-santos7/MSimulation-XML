import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import { fiscalNotDeleted } from "../../domain/constants/fiscal-not-deleted.js";
import { listTimelineChains } from "./timeline-service.js";
import {
  buildTimelineSpreadsheetXlsx,
  type TimelineNfeExportDetail,
} from "./timeline-spreadsheet.export.js";

function resolveProdutoSku(
  product?: { sku: string } | null,
  itemProduct?: { sku: string } | null,
): string {
  const picked = product ?? itemProduct;
  return picked?.sku?.trim() ?? "";
}

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
 * Monta planilha XLSX com todos os cenários fiscais do tenant.
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
