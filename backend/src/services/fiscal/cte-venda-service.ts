import {
  CteModal,
  FiscalStatus,
  type NFe,
  type Tenant,
} from "../../generated/prisma/client.js";
import type { PrismaTx } from "../../lib/db/prisma-tx.js";
import { buildChaveCTe } from "../../lib/fiscal/cte-chave.js";
import {
  calcularPesoCarga,
  calcularValorFreteRemessa,
  CTE_ML_EMIT,
  CTE_REMESSA_CFOP,
  CTE_REMESSA_NAT_OP,
} from "../../lib/fiscal/cte-remessa-template.js";
import { proximoNumeroCte } from "../../lib/fiscal/cte-sequencia.js";
import { mapCte } from "../../lib/fiscal/fiscal-mappers.js";

/** CT-e de transporte da venda (full → consumidor), referenciando a NF-e de venda. */
export async function emitirCteVenda(
  prisma: PrismaTx,
  tenant: Tenant,
  nfeVenda: NFe,
) {
  const serie = tenant.serieCte;
  const numero = await proximoNumeroCte(prisma, tenant.id, serie);
  const valorCarga = Number(nfeVenda.valor);
  const valorFrete = calcularValorFreteRemessa(valorCarga);
  const pesoCarga = calcularPesoCarga(nfeVenda.quantidade);
  const emitidoEm = new Date();

  const origem = `${tenant.municipio}/${tenant.uf}`;
  const destino = `${nfeVenda.destMunicipio}/${nfeVenda.destUf}`;

  const chave = buildChaveCTe({
    uf: CTE_ML_EMIT.uf,
    cnpj: CTE_ML_EMIT.cnpj,
    serie,
    numero,
  });

  const row = await prisma.cTe.create({
    data: {
      tenantId: tenant.id,
      nfeVendaId: nfeVenda.id,
      chave,
      numero,
      serie,
      cfop: CTE_REMESSA_CFOP,
      natOp: CTE_REMESSA_NAT_OP,
      modal: CteModal.RODOVIARIO,
      origem,
      destino,
      valor: valorFrete,
      valorCarga,
      pesoCarga,
      status: FiscalStatus.AUTORIZADA,
      emitidoEm,
    },
  });

  return mapCte(row, nfeVenda.chave);
}
