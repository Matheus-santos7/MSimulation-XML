import type { PrismaClient } from "../../../generated/prisma/client.js";
import { mapNfe } from "../../../lib/fiscal/fiscal-mappers.js";
import type { EmitirAvancoMercadoriaResult } from "../application/dto/emitir-avanco-mercadoria.command.js";

/** Mantém contrato legado da API POST /movimentacoes/avanco-cd. */
export async function mapAvancoMercadoriaParaApi(
  prisma: PrismaClient,
  result: EmitirAvancoMercadoriaResult,
) {
  const remessaSimbRow = await prisma.nFe.findUniqueOrThrow({
    where: { id: result.remessaSimbolica.id },
    include: { nfeReferencia: { select: { chave: true } } },
  });

  const retornoRow = await prisma.nFe.findUniqueOrThrow({
    where: { id: result.retornoSimbolico.id },
    include: { nfeReferencia: { select: { chave: true } } },
  });

  return {
    remessaSimbolica: mapNfe(remessaSimbRow, remessaSimbRow.nfeReferencia?.chave),
    retornoSimbolico: mapNfe(retornoRow, retornoRow.nfeReferencia?.chave),
    alocacoesOrigem: result.alocacoesFifo.map((a) => ({
      remessaNfeId: a.remessaNfeId,
      quantidade: a.quantidade,
    })),
  };
}
