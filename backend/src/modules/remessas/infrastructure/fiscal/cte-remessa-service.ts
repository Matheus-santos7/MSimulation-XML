/**
 * CT-e de transporte da remessa física ou simbólica (seller → destino da NF-e).
 *
 * @see cte-emissao.ts — montagem unificada com venda
 * @see docs/remessa-fisica.md — Fase 9
 */
import type { NFe, Tenant } from "../../../../generated/prisma/client.js";
import { dadosCteToPrismaCreate, montarDadosCteFromNfe } from "../../../../lib/fiscal/cte-emissao.js";
import { proximoNumeroCte } from "../../../../lib/fiscal/cte-sequencia.js";
import { mapCte } from "../../../../lib/fiscal/fiscal-mappers.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { buildCteXmlAutorizado } from "../../../fiscal-documents/infrastructure/xml/cte-xml-service.js";

/**
 * Cria CT-e vinculado à NF-e de remessa (física ou simbólica) recém-emitida.
 */
export async function emitirCteRemessa(prisma: PrismaTx, tenant: Tenant, nfeRemessa: NFe) {
  const serie = tenant.serieCte;
  const numero = await proximoNumeroCte(prisma, tenant.id, serie);
  const dados = await montarDadosCteFromNfe(prisma, tenant, nfeRemessa, "remessa", { serie, numero });
  const xmlAutorizado = buildCteXmlAutorizado(dados, tenant);

  const row = await prisma.cTe.create({
    data: dadosCteToPrismaCreate(tenant.id, dados, xmlAutorizado),
  });

  return mapCte(row);
}
