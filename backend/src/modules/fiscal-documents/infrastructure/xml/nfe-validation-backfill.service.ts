import { NfeValidationStatus } from "../../../../generated/prisma/client.js";
import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import { loadFiscalValidatorConfig } from "../../../../lib/fiscal-validator-config.js";
import { getFiscalValidator } from "../../../../lib/fiscal-validator-factory.js";
import { resolveNfeValidationUpdate } from "./nfe-xml-validation.js";
import { resolveNfeXmlStringFromLoadedRow } from "./nfe-xml-service.js";

export type NfeValidationBackfillResult = {
  processed: number;
  approved: number;
  rejected: number;
  pending: number;
  skipped: number;
  remaining: number;
};

const DEFAULT_BATCH_LIMIT = 50;
const MAX_BATCH_LIMIT = 200;

/**
 * Revalidates pending NF-es for a tenant using stored or regenerated XML.
 */
export async function backfillPendingNfeValidations(
  db: DbClient,
  tenantId: string,
  options: { limit?: number } = {},
): Promise<NfeValidationBackfillResult> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_BATCH_LIMIT, 1), MAX_BATCH_LIMIT);
  const config = loadFiscalValidatorConfig();
  const validator = getFiscalValidator();

  const rows = await db.nFe.findMany({
    where: {
      tenantId,
      deletedAt: null,
      statusValidacao: NfeValidationStatus.PENDING,
    },
    orderBy: { emitidaEm: "desc" },
    take: limit,
    include: {
      nfeReferencia: { select: { chave: true } },
      tenant: true,
      product: true,
      itens: { include: { product: true }, orderBy: { numeroItem: "asc" } },
    },
  });

  const result: NfeValidationBackfillResult = {
    processed: 0,
    approved: 0,
    rejected: 0,
    pending: 0,
    skipped: 0,
    remaining: 0,
  };

  for (const row of rows) {
    const xml = await resolveNfeXmlStringFromLoadedRow(db, tenantId, row);
    if (!xml) {
      result.skipped += 1;
      continue;
    }

    const validationUpdate = await resolveNfeValidationUpdate(validator, xml, config);
    await db.nFe.update({
      where: { id: row.id },
      data: validationUpdate,
    });

    result.processed += 1;
    if (validationUpdate.statusValidacao === NfeValidationStatus.APPROVED) {
      result.approved += 1;
    } else if (validationUpdate.statusValidacao === NfeValidationStatus.REJECTED) {
      result.rejected += 1;
    } else {
      result.pending += 1;
    }
  }

  result.remaining = await db.nFe.count({
    where: {
      tenantId,
      deletedAt: null,
      statusValidacao: NfeValidationStatus.PENDING,
    },
  });

  return result;
}
