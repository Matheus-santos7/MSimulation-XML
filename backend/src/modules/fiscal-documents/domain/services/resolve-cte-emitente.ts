import {
  defaultCteEmitente,
  mapLogisticsUnitToCteEmitente,
  remessaUsesCdAsCteEmitente,
  type CteEmitente,
  type CteVinculo,
} from "@msimulation-xml/fiscal-core";
import type { Tenant } from "../../../../generated/prisma/client.js";
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
 * - **Remessa:** CD destino da NF-e quando seller e CD estão na mesma UF.
 * - **Venda:** CD na UF do consumidor (`destUf` da NF-e de venda).
 */
export async function resolveCteEmitente(
  prisma: PrismaTx,
  tenantId: string,
  tenant: Tenant,
  nfe: NfeCteEmitenteContext,
  vinculo: CteVinculo,
): Promise<CteEmitente> {
  const cdUf = nfe.destUf.trim().toUpperCase();
  if (!cdUf) return defaultCteEmitente();

  if (vinculo === "remessa" && !remessaUsesCdAsCteEmitente(tenant.uf, cdUf)) {
    return defaultCteEmitente();
  }

  const unit = await findLinkedCdByUf(prisma, tenantId, cdUf, nfe.unidadeDestinoId);

  return unit ? mapLogisticsUnitToCteEmitente(unit) : defaultCteEmitente();
}
