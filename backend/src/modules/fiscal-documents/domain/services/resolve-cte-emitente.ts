import {
  defaultCteEmitente,
  mapLogisticsUnitToCteEmitente,
  type CteEmitente,
  type CteVinculo,
} from "@msimulation-xml/fiscal-core";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";

const CD_EMITENTE_SELECT = {
  cnpj: true,
  ie: true,
  destNomeFiscal: true,
  nome: true,
  logradouro: true,
  numero: true,
  bairro: true,
  codigoMunicipio: true,
  municipio: true,
  uf: true,
  cep: true,
} as const;

type NfeCteEmitenteContext = {
  id: string;
  destUf: string;
  unidadeDestinoId?: string | null;
};

/**
 * Localiza CD ML vinculado ao tenant na UF informada.
 * Prioridade: unidade da NF-e → CD padrão do tenant → primeiro CD ativo na UF.
 */
async function findLinkedCdByUf(
  prisma: PrismaTx,
  tenantId: string,
  uf: string,
  preferredUnitId?: string | null,
) {
  const normalizedUf = uf.trim().toUpperCase();

  if (preferredUnitId) {
    const preferred = await prisma.meliUnidadeLogistica.findFirst({
      where: {
        id: preferredUnitId,
        uf: normalizedUf,
        ativa: true,
        tenantLinks: { some: { tenantId } },
      },
      select: CD_EMITENTE_SELECT,
    });
    if (preferred) return preferred;
  }

  const defaultLink = await prisma.tenantUnidadeLogistica.findFirst({
    where: {
      tenantId,
      padrao: true,
      unidade: { ativa: true, uf: normalizedUf },
    },
    select: { unidade: { select: CD_EMITENTE_SELECT } },
  });
  if (defaultLink?.unidade) return defaultLink.unidade;

  const anyLink = await prisma.tenantUnidadeLogistica.findFirst({
    where: {
      tenantId,
      unidade: { ativa: true, uf: normalizedUf },
    },
    orderBy: { unidade: { codigo: "asc" } },
    select: { unidade: { select: CD_EMITENTE_SELECT } },
  });

  return anyLink?.unidade ?? null;
}

/**
 * Resolve emitente do CT-e a partir dos CDs Mercado Livre cadastrados.
 *
 * Remessa e venda usam a mesma regra: CD vinculado ao tenant na UF de destino
 * da NF-e (`destUf` — CD na remessa, consumidor na venda).
 */
export async function resolveCteEmitente(
  prisma: PrismaTx,
  tenantId: string,
  _tenant: unknown,
  nfe: NfeCteEmitenteContext,
  _vinculo: CteVinculo,
): Promise<CteEmitente> {
  const cdUf = nfe.destUf.trim().toUpperCase();
  if (!cdUf) return defaultCteEmitente();

  const unit = await findLinkedCdByUf(prisma, tenantId, cdUf, nfe.unidadeDestinoId);

  return unit ? mapLogisticsUnitToCteEmitente(unit) : defaultCteEmitente();
}
