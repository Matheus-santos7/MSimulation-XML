import { Inject, Injectable } from "@nestjs/common";
import { NfeValidationStatus } from "../../../../generated/prisma/client.js";
import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import { FiscalValidatorProvider } from "../../providers/fiscal-validator/fiscal-validator.provider.js";
import type { ValidatorHealth } from "../../validator-status/validator-status.types.js";
import { toPrismaNfeValidationUpdate } from "../nfe-validation.mapper.js";
import { resolveNfeValidation } from "../rules/resolve-nfe-validation.js";
import {
  NFE_XML_CONTENT_RESOLVER,
  type NfeXmlContentResolver,
} from "../types/nfe-xml-content-resolver.types.js";

export type NfeValidationBackfillResult = {
  processed: number;
  approved: number;
  rejected: number;
  pending: number;
  skipped: number;
  remaining: number;
  validator: ValidatorHealth;
  samplePendingMessage?: string;
};

const DEFAULT_BATCH_LIMIT = 50;
const MAX_BATCH_LIMIT = 200;

/**
 * Revalida NF-es com validação pendente: ação de admin e disparo pós-commit das transações
 * fiscais (ver `FiscalValidationModule`).
 */
@Injectable()
export class NfeValidationBackfillUseCase {
  constructor(
    @Inject(FiscalValidatorProvider) private readonly validator: FiscalValidatorProvider,
    @Inject(NFE_XML_CONTENT_RESOLVER) private readonly nfeXmlResolver: NfeXmlContentResolver,
  ) {}

  async execute(
    db: DbClient,
    tenantId: string,
    options: { limit?: number } = {},
  ): Promise<NfeValidationBackfillResult> {
    const limit = Math.min(Math.max(options.limit ?? DEFAULT_BATCH_LIMIT, 1), MAX_BATCH_LIMIT);
    const validatorStatus = await this.validator.health();

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

      const outcome = await resolveNfeValidation(this.validator, xml, this.validator.config);
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
