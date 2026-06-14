import type { DbClient } from "../../../lib/db/prisma-tx.js";
import { mapNfe } from "../../fiscal-documents/presentation/mappers/fiscal-mappers.js";
import type { EmitirAvancoMercadoriaResult } from "../application/dto/emitir-avanco-mercadoria.command.js";

/** Mantém contrato legado da API POST /movimentacoes/avanco-cd. */
export async function mapAvancoMercadoriaParaApi(
  db: DbClient,
  result: EmitirAvancoMercadoriaResult,
) {
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
