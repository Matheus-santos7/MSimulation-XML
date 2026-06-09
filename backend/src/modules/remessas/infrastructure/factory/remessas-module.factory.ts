import type { PrismaClient } from "../../../../generated/prisma/client.js";
import { gerarPedidoMl } from "../../../../lib/fiscal/nfe-chave.js";
import { emitirNFeRemessa, emitirRemessaManual } from "../../../../services/fiscal/remessa/remessa-service.js";
import { resolveProductForAvanco } from "../../../../services/logistics/avanco-product-resolve.js";
import { EmitirAvancoMercadoriaUseCase } from "../../application/use-cases/emitir-avanco-mercadoria.js";
import { EmitirRemessaInicialUseCase } from "../../application/use-cases/emitir-remessa-inicial.js";
import { createRemessasAdapters } from "./remessas-adapters.js";

/**
 * Composition Root do módulo Remessas.
 */
export function createRemessasModule(prisma: PrismaClient) {
  const adapters = createRemessasAdapters(prisma);

  const emitirRemessaInicial = new EmitirRemessaInicialUseCase({
    prisma,
    estoqueFifo: adapters.estoqueFifo,
    unidadeLogistica: adapters.unidadeLogistica,
    emitirRemessaLegado: async (_tx, command) => {
      return emitirRemessaManual(prisma, {
        tenantId: command.tenantId,
        unidadeDestinoId: command.unidadeDestinoId!,
        items: command.items.map((i) => ({
          productId: i.productId,
          quantidade: i.quantidade,
        })),
      });
    },
  });

  const emitirAvancoMercadoria = new EmitirAvancoMercadoriaUseCase({
    prisma,
    estoqueFifo: adapters.estoqueFifo,
    unidadeLogistica: adapters.unidadeLogistica,
    createAdapters: createRemessasAdapters,
    resolverProduto: (tenantId, productId, productSku) =>
      resolveProductForAvanco(prisma, tenantId, productId, productSku),
    emitirRemessaFisicaDestino: async ({
      tenant,
      product,
      quantidade,
      unidadeDestinoId,
      pedidoMl,
      observacaoAvanco,
    }) => {
      const { nfe } = await emitirNFeRemessa(prisma, tenant, product, quantidade, {
        unidadeDestinoId,
        pedidoMl: pedidoMl || gerarPedidoMl(),
        observacaoAvanco,
      });
      return { id: nfe.id as string, chave: nfe.chave as string };
    },
  });

  return {
    emitirRemessaInicial,
    emitirAvancoMercadoria,
    adapters,
  };
}
