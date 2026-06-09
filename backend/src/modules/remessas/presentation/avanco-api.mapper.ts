import type { PrismaClient } from "../../../generated/prisma/client.js";
import { mapNfe } from "../../../lib/fiscal/fiscal-mappers.js";
import type { EmitirAvancoMercadoriaResult } from "../application/dto/emitir-avanco-mercadoria.command.js";

/** Mantém contrato legado da API POST /movimentacoes/avanco-cd. */
export async function mapAvancoMercadoriaParaApi(
  prisma: PrismaClient,
  result: EmitirAvancoMercadoriaResult,
) {
  const [remessaSimbRow, remessaDestRow, cteRow] = await Promise.all([
    prisma.nFe.findUniqueOrThrow({
      where: { id: result.remessaSimbolica.id },
      include: { nfeReferencia: { select: { chave: true } } },
    }),
    prisma.nFe.findUniqueOrThrow({
      where: { id: result.remessaDestino.id },
      include: { nfeReferencia: { select: { chave: true } } },
    }),
    prisma.cTe.findFirst({
      where: { nfeRemessaId: result.remessaDestino.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    remessaSimbolica: mapNfe(remessaSimbRow, remessaSimbRow.nfeReferencia?.chave),
    retornoSimbolico: result.retornoSimbolico,
    remessaDestino: mapNfe(remessaDestRow, remessaDestRow.nfeReferencia?.chave),
    cte: cteRow
      ? {
          id: cteRow.id,
          chave: cteRow.chave,
          status: cteRow.status,
        }
      : undefined,
    alocacoesOrigem: result.alocacoesFifo.map((a) => ({
      remessaNfeId: a.remessaNfeId,
      quantidade: a.quantidade,
    })),
  };
}
