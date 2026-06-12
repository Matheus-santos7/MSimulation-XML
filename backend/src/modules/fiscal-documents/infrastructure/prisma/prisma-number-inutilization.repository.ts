/**
 * NF-e number range inutilization (procInutNFe) — unused numbers in a series.
 */

import type { PrismaClient } from "../../../../generated/prisma/client.js";
import { gerarProtocoloSefaz } from "../../../../lib/fiscal/sefaz-protocol.js";
import { fiscalNotDeleted } from "../../domain/constants/fiscal-not-deleted.js";
import type { InutilizationResult } from "../../domain/entities/lifecycle-result.entity.js";
import { NumberInutilizationError } from "../../domain/errors/number-inutilization.error.js";
import type {
  InutilizeNumberInput,
  NumberInutilizationPort,
} from "../../domain/ports/fiscal-document-lifecycle.port.js";

export class PrismaNumberInutilizationRepository implements NumberInutilizationPort {
  constructor(private readonly prisma: PrismaClient) {}

  async inutilizeRange(input: InutilizeNumberInput): Promise<InutilizationResult> {
    const { tenantId, series, numberStart, numberEnd } = input;

    if (numberStart < 1 || numberEnd < 1 || numberStart > numberEnd) {
      throw new NumberInutilizationError(
        "Informe uma faixa válida (número inicial ≤ final, ambos ≥ 1).",
        422,
      );
    }

    const justification =
      (input.justification?.trim().length ?? 0) >= 15
        ? input.justification!.trim()
        : "Numero nao utilizado dentro do prazo legal";

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NumberInutilizationError("Tenant não encontrado.", 404);

    const existingNfes = await this.prisma.nFe.findMany({
      where: {
        tenantId,
        serie: series,
        numero: { gte: numberStart, lte: numberEnd },
        ...fiscalNotDeleted,
      },
      select: { numero: true },
    });
    if (existingNfes.length > 0) {
      const numbers = existingNfes.map((n) => n.numero).join(", ");
      throw new NumberInutilizationError(
        `Não é possível inutilizar: já existem NF-e emitidas na faixa (nº ${numbers}).`,
        409,
      );
    }

    const previousInutilizations = await this.prisma.nfeInutilizacao.findMany({
      where: { tenantId, serie: series },
    });
    for (const previous of previousInutilizations) {
      if (rangesOverlap(numberStart, numberEnd, previous.numeroIni, previous.numeroFim)) {
        throw new NumberInutilizationError(
          `Faixa sobrepõe inutilização anterior (${previous.numeroIni}–${previous.numeroFim}).`,
          409,
        );
      }
    }

    const occurredAt = new Date();
    const row = await this.prisma.nfeInutilizacao.create({
      data: {
        tenantId,
        serie: series,
        numeroIni: numberStart,
        numeroFim: numberEnd,
        xJust: justification,
        protocolo: gerarProtocoloSefaz(),
        ocorridoEm: occurredAt,
      },
    });

    return {
      id: row.id,
      tipo: "INUT",
      descricao: "Inutilização de numeração",
      serie: row.serie,
      numeroIni: row.numeroIni,
      numeroFim: row.numeroFim,
      xJust: row.xJust,
      protocolo: row.protocolo,
      ocorridoEm: row.ocorridoEm.toISOString(),
    };
  }
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}
