import { computeProximoNumeroNfe } from "@msimulation-xml/fiscal-core";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { fiscalNotDeleted } from "../constants/fiscal-not-deleted.js";

/** Último número de NF-e emitido para tenant + série (ou null se nunca emitiu). */
export async function ultimoNumeroNfe(
  prisma: PrismaTx,
  tenantId: string,
  serie: number,
): Promise<number | null> {
  const last = await prisma.nFe.findFirst({
    where: { tenantId, serie, ...fiscalNotDeleted },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  return last?.numero ?? null;
}

/**
 * Próximo número da NF-e para a série informada (por tenant).
 *
 * Respeita `numeroInicial` configurado: sequência normal após emissões,
 * ou salto quando o piso configurado supera o último emitido.
 */
export async function proximoNumeroNfe(
  prisma: PrismaTx,
  tenantId: string,
  serie: number,
  numeroInicial = 1,
): Promise<number> {
  const ultimo = await ultimoNumeroNfe(prisma, tenantId, serie);
  return computeProximoNumeroNfe(ultimo, numeroInicial);
}
