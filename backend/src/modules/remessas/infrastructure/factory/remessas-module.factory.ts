import type { PrismaClient } from "../../../../generated/prisma/client.js";
import { emitirRemessaManual } from "../../../../services/fiscal/remessa/remessa-service.js";
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
  });

  return {
    emitirRemessaInicial,
    emitirAvancoMercadoria,
    adapters,
  };
}
