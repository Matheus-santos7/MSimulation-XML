import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import {
  backfillPendingNfeValidations,
  type NfeValidationBackfillResult,
} from "../../infrastructure/xml/nfe-validation-backfill.service.js";

/** Revalidates pending NF-es on demand (admin action). */
export class BackfillNfeValidationUseCase {
  async execute(
    db: DbClient,
    tenantId: string,
    options: { limit?: number } = {},
  ): Promise<NfeValidationBackfillResult> {
    return backfillPendingNfeValidations(db, tenantId, options);
  }
}
