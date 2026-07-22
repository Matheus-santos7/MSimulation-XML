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

/** Faixas inutilizadas (procInutNFe) da série — números que não podem ser reemitidos. */
export async function listInutilizacoesSerie(
  prisma: PrismaTx,
  tenantId: string,
  serie: number,
): Promise<Array<{ numeroIni: number; numeroFim: number }>> {
  return prisma.nfeInutilizacao.findMany({
    where: { tenantId, serie },
    select: { numeroIni: true, numeroFim: true },
    orderBy: { numeroIni: "asc" },
  });
}

/**
 * Próximo número da NF-e para a série informada (por tenant).
 *
 * Respeita `numeroInicial` configurado e **pula faixas inutilizadas**
 * (`nfe_inutilizacoes`), para venda, remessa, retorno, devolução, etc.
 */
export async function proximoNumeroNfe(
  prisma: PrismaTx,
  tenantId: string,
  serie: number,
  numeroInicial = 1,
): Promise<number> {
  const [ultimo, inutilizacoes] = await Promise.all([
    ultimoNumeroNfe(prisma, tenantId, serie),
    listInutilizacoesSerie(prisma, tenantId, serie),
  ]);
  return computeProximoNumeroNfe(ultimo, numeroInicial, inutilizacoes);
}
