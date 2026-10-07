import { computeProximoNumeroNfe } from "@msimulation-xml/fiscal-core";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";

/**
 * Serializa a numeração por tenant+série via advisory lock do Postgres
 * escopado à transação (`pg_advisory_xact_lock`): liberado automaticamente
 * no commit/rollback de `prisma`, sem risco de lock esquecido. Fecha a
 * janela de corrida entre ler o último número e inserir a nova NF-e —
 * concorrência em séries diferentes (ou tenants diferentes) não é afetada.
 */
async function lockNumeracaoSerie(
  prisma: PrismaTx,
  tenantId: string,
  serie: number,
): Promise<void> {
  await prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}), ${serie})`;
}

/**
 * Último número de NF-e emitido para tenant + série (ou null se nunca emitiu).
 *
 * Considera também NF-e com soft-delete: o número fiscal nunca é liberado
 * para reuso (mesma regra da constraint `uq_nfe_tenant_serie_numero`).
 */
export async function ultimoNumeroNfe(
  prisma: PrismaTx,
  tenantId: string,
  serie: number,
): Promise<number | null> {
  const last = await prisma.nFe.findFirst({
    where: { tenantId, serie },
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
 *
 * Adquire `lockNumeracaoSerie` antes de ler o último número: concorrência
 * no mesmo tenant+série fica serializada dentro da transação. `prisma`
 * **precisa** ser a transação que também fará o `nFe.create` — chamar esta
 * função fora da transação do insert reabre a janela de corrida que o lock
 * deveria fechar. A constraint `uq_nfe_tenant_serie_numero` é a rede de
 * segurança final caso algum chamador viole essa premissa.
 */
export async function proximoNumeroNfe(
  prisma: PrismaTx,
  tenantId: string,
  serie: number,
  numeroInicial = 1,
): Promise<number> {
  await lockNumeracaoSerie(prisma, tenantId, serie);
  const [ultimo, inutilizacoes] = await Promise.all([
    ultimoNumeroNfe(prisma, tenantId, serie),
    listInutilizacoesSerie(prisma, tenantId, serie),
  ]);
  return computeProximoNumeroNfe(ultimo, numeroInicial, inutilizacoes);
}
