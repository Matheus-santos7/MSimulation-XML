import type { NFe, Tenant } from "../../../../generated/prisma/client.js";
import { dadosCteToPrismaCreate, montarDadosCteFromNfe } from "../../../../lib/fiscal/cte-emissao.js";
import { proximoNumeroCte } from "../../../../lib/fiscal/cte-sequencia.js";
import { mapCte } from "../../../../lib/fiscal/fiscal-mappers.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { buildCteXmlAutorizado } from "../../../../services/fiscal/shared/cte-xml-service.js";

/** CT-e for sale transport (warehouse → consumer), referencing the sale NF-e. */
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
