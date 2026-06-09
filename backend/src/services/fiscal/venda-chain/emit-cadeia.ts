import type { PrismaClient } from "../../../generated/prisma/client.js";
import { mapNfe } from "../../../lib/fiscal-mappers.js";
import { emitirCteVenda } from "../cte-venda-service.js";
import { assertProdutoComRegra, buildContextoEmissao } from "./context.js";
import { consumirRemessaEVincularRetorno, emitirNotaRetorno } from "./emit-retorno.js";
import { emitirNotaVenda } from "./emit-venda.js";
import { resolverRegrasFiscais } from "./resolver-regras.js";
import type { PedidoForEmit } from "./types.js";

/**
 * Emite retorno simbólico + venda + CT-e de venda em uma única transação.
 *
 * @returns DTOs mapeados para a API; `alocacoes` descreve o FIFO consumido.
 */
export async function emitirCadeiaVenda(prisma: PrismaClient, pedido: PedidoForEmit) {
  const ruleBaseId = assertProdutoComRegra(pedido);
  const ctx = buildContextoEmissao(pedido, ruleBaseId);

  return prisma.$transaction(async (tx) => {
    const regras = await resolverRegrasFiscais(tx, pedido, ctx);

    const retorno = await emitirNotaRetorno(tx, pedido, ctx, regras);
    const alocacoes = await consumirRemessaEVincularRetorno(
      tx,
      pedido,
      retorno,
      regras.emitterSettings,
    );

    const vendaRow = await emitirNotaVenda(tx, pedido, ctx, regras, retorno);
    const cteVenda = await emitirCteVenda(tx, pedido.tenant, vendaRow);

    const retornoComRef = await tx.nFe.findUniqueOrThrow({
      where: { id: retorno.id },
      include: { nfeReferencia: { select: { chave: true, numero: true, serie: true } } },
    });

    return {
      venda: mapNfe(vendaRow, retorno.chave),
      retorno: mapNfe(retornoComRef, retornoComRef.nfeReferencia?.chave),
      cteVenda,
      alocacoes,
    };
  });
}
