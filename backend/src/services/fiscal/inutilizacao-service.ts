/**
 * Inutilização de numeração NF-e (procInutNFe) — faixa não utilizada na série.
 */

import type { PrismaClient } from "../../generated/prisma/client.js";
import { gerarProtocoloSefaz } from "../../lib/fiscal/sefaz-protocol.js";
import { fiscalNotDeleted } from "./fiscal-service.js";

export class InutilizacaoError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "InutilizacaoError";
  }
}

export type InutilizarNumeracaoInput = {
  tenantId: string;
  serie: number;
  numeroIni: number;
  numeroFim: number;
  xJust?: string;
};

function rangesOverlap(aIni: number, aFim: number, bIni: number, bFim: number): boolean {
  return aIni <= bFim && bIni <= aFim;
}

export async function inutilizarNumeracao(prisma: PrismaClient, input: InutilizarNumeracaoInput) {
  const { tenantId, serie, numeroIni, numeroFim } = input;

  if (numeroIni < 1 || numeroFim < 1 || numeroIni > numeroFim) {
    throw new InutilizacaoError("Informe uma faixa válida (número inicial ≤ final, ambos ≥ 1).", 422);
  }

  const xJust =
    (input.xJust?.trim().length ?? 0) >= 15
      ? input.xJust!.trim()
      : "Numero nao utilizado dentro do prazo legal";

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new InutilizacaoError("Tenant não encontrado.", 404);

  const existentes = await prisma.nFe.findMany({
    where: {
      tenantId,
      serie,
      numero: { gte: numeroIni, lte: numeroFim },
      ...fiscalNotDeleted,
    },
    select: { numero: true },
  });
  if (existentes.length > 0) {
    const nums = existentes.map((n) => n.numero).join(", ");
    throw new InutilizacaoError(
      `Não é possível inutilizar: já existem NF-e emitidas na faixa (nº ${nums}).`,
      409,
    );
  }

  const inutsAnteriores = await prisma.nfeInutilizacao.findMany({
    where: { tenantId, serie },
  });
  for (const inut of inutsAnteriores) {
    if (rangesOverlap(numeroIni, numeroFim, inut.numeroIni, inut.numeroFim)) {
      throw new InutilizacaoError(
        `Faixa sobrepõe inutilização anterior (${inut.numeroIni}–${inut.numeroFim}).`,
        409,
      );
    }
  }

  const ocorridoEm = new Date();
  const row = await prisma.nfeInutilizacao.create({
    data: {
      tenantId,
      serie,
      numeroIni,
      numeroFim,
      xJust,
      protocolo: gerarProtocoloSefaz(),
      ocorridoEm,
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
