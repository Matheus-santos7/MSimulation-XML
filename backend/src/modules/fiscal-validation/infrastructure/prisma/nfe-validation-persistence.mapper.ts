import { NfeValidationStatus, Prisma } from "../../../../generated/prisma/client.js";
import type { NfeValidationOutcome } from "../../domain/entities/nfe-validation-outcome.entity.js";

/** Maps domain validation outcome to Prisma NF-e update fields. */
export function toPrismaNfeValidationUpdate(
  outcome: NfeValidationOutcome,
): Pick<
  Prisma.NFeUpdateInput,
  "statusValidacao" | "mensagemValidacao" | "errosValidacao" | "auditoriaMcp"
> {
  const statusMap: Record<NfeValidationOutcome["status"], NfeValidationStatus> = {
    PENDING: NfeValidationStatus.PENDING,
    APPROVED: NfeValidationStatus.APPROVED,
    REJECTED: NfeValidationStatus.REJECTED,
  };

  return {
    statusValidacao: statusMap[outcome.status],
    mensagemValidacao: outcome.message,
    errosValidacao: outcome.errors ?? Prisma.DbNull,
    auditoriaMcp: outcome.audit ?? Prisma.DbNull,
  };
}
