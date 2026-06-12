import type { NFe, Tenant } from "../../../../generated/prisma/client.js";
import { dadosCteToPrismaCreate, montarDadosCteFromNfe } from "../../../fiscal-documents/domain/services/cte-emissao.js";
import { proximoNumeroCte } from "../../../fiscal-documents/domain/services/cte-sequencia.js";
import { mapCte } from "../../../../lib/fiscal/fiscal-mappers.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { buildCteXmlAutorizado } from "../../../fiscal-documents/infrastructure/xml/cte-xml-service.js";

/**
 * Emite **CT-e de venda** (transporte CD → consumidor) referenciando a NF-e VENDA.
 *
 * @param saleNfe - NF-e de venda persistida na etapa anterior da cadeia
 */
export async function emitSaleCte(prisma: PrismaTx, tenant: Tenant, saleNfe: NFe) {
  const serie = tenant.serieCte;
  const numero = await proximoNumeroCte(prisma, tenant.id, serie);
  const data = await montarDadosCteFromNfe(prisma, tenant, saleNfe, "venda", { serie, numero });
  const authorizedXml = buildCteXmlAutorizado(data, tenant);

  const row = await prisma.cTe.create({
    data: dadosCteToPrismaCreate(tenant.id, data, authorizedXml),
  });

  return mapCte(row);
}
