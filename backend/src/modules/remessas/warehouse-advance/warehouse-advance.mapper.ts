import type { DbClient } from "../../../lib/db/prisma-tx.js";
import { mapNfe } from "../../fiscal-documents/index.js";
import type { WarehouseAdvanceResult } from "./warehouse-advance.types.js";

/** Mantém contrato legado da API POST /movimentacoes/avanco-cd. */
export async function mapAvancoMercadoriaParaApi(db: DbClient, result: WarehouseAdvanceResult) {
  const remessaSimbRow = await db.nFe.findUniqueOrThrow({
    where: { id: result.remessaSimbolica.id },
    include: { nfeReferencia: { select: { chave: true } } },
  });

  const retornoRow = await db.nFe.findUniqueOrThrow({
    where: { id: result.retornoSimbolico.id },
    include: { nfeReferencia: { select: { chave: true } } },
  });

  return {
    remessaSimbolica: mapNfe(remessaSimbRow, remessaSimbRow.nfeReferencia?.chave),
    retornoSimbolico: mapNfe(retornoRow, retornoRow.nfeReferencia?.chave),
    cte: result.cte,
    alocacoesOrigem: result.alocacoesFifo.map((a) => ({
      remessaNfeId: a.remessaNfeId,
      quantidade: a.quantidade,
    })),
  };
}
