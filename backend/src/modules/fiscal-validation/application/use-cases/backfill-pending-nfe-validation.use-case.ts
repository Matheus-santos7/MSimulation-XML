import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import { NfeValidationStatus } from "../../../../generated/prisma/client.js";
import type { McpFiscalValidatorPort } from "../../domain/ports/mcp-fiscal-validator.port.js";
import type { NfeXmlContentResolverPort } from "../../domain/ports/nfe-xml-content-resolver.port.js";
import { resolveNfeValidation } from "../../domain/services/resolve-nfe-validation.service.js";
import { toPrismaNfeValidationUpdate } from "../../infrastructure/prisma/nfe-validation-persistence.mapper.js";
import type { FiscalValidatorConfig } from "../../infrastructure/config/fiscal-validator.config.js";
import type { ValidatorHealthDto } from "../dto/validator-health.dto.js";
import { probeValidatorHealth } from "../../infrastructure/external/validator-health.probe.js";

export type NfeValidationBackfillResult = {
  processed: number;
  approved: number;
  rejected: number;
  pending: number;
  skipped: number;
  remaining: number;
  validator: ValidatorHealthDto;
  samplePendingMessage?: string;
};

const DEFAULT_BATCH_LIMIT = 50;
const MAX_BATCH_LIMIT = 200;

/** Revalidates pending NF-es on demand (admin action). */
export class BackfillPendingNfeValidationUseCase {
  constructor(
    private readonly validator: McpFiscalValidatorPort,
    private readonly nfeXmlResolver: NfeXmlContentResolverPort,
    private readonly config: FiscalValidatorConfig,
  ) {}

  async execute(
    db: DbClient,
    tenantId: string,
    options: { limit?: number } = {},
  ): Promise<NfeValidationBackfillResult> {
    const limit = Math.min(Math.max(options.limit ?? DEFAULT_BATCH_LIMIT, 1), MAX_BATCH_LIMIT);
    const validatorStatus = await probeValidatorHealth(this.config);

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
      validator: validatorStatus,
    };

    let samplePendingMessage: string | undefined;

    for (const row of rows) {
      const xml = await this.nfeXmlResolver.resolveXml(db, tenantId, row);
      if (!xml) {
        result.skipped += 1;
        continue;
      }

      const outcome = await resolveNfeValidation(this.validator, xml, this.config);
      const validationUpdate = toPrismaNfeValidationUpdate(outcome);
      await db.nFe.update({
        where: { id: row.id },
        data: validationUpdate,
      });

      result.processed += 1;
      if (outcome.status === "APPROVED") {
        result.approved += 1;
      } else if (outcome.status === "REJECTED") {
        result.rejected += 1;
      } else {
        result.pending += 1;
        if (!samplePendingMessage && outcome.message) {
          samplePendingMessage = outcome.message;
        }
      }
    }

    result.remaining = await db.nFe.count({
      where: {
        tenantId,
        deletedAt: null,
        statusValidacao: NfeValidationStatus.PENDING,
      },
    });

    if (samplePendingMessage) {
      result.samplePendingMessage = samplePendingMessage;
    }

    return result;
  }
}
