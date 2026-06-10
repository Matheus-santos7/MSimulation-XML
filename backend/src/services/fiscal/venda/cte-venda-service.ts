import type { NFe, Tenant } from "../../../generated/prisma/client.js";
import { dadosCteToPrismaCreate, montarDadosCteFromNfe } from "../../../lib/fiscal/cte-emissao.js";
import { proximoNumeroCte } from "../../../lib/fiscal/cte-sequencia.js";
import { mapCte } from "../../../lib/fiscal/fiscal-mappers.js";
import type { PrismaTx } from "../../../lib/db/prisma-tx.js";
import { buildCteXmlAutorizado } from "../shared/cte-xml-service.js";

/** CT-e de transporte da venda (CD → consumidor), referenciando a NF-e de venda. */
export async function emitirCteVenda(prisma: PrismaTx, tenant: Tenant, nfeVenda: NFe) {
  const serie = tenant.serieCte;
  const numero = await proximoNumeroCte(prisma, tenant.id, serie);
  const dados = await montarDadosCteFromNfe(prisma, tenant, nfeVenda, "venda", { serie, numero });
  const xmlAutorizado = buildCteXmlAutorizado(dados, tenant);

  const row = await prisma.cTe.create({
    data: dadosCteToPrismaCreate(tenant.id, dados, xmlAutorizado),
  });

  return mapCte(row);
}
