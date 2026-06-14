import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import { emitirRemessaManual } from "../fiscal/remessa-service.js";
import { createLogisticsModule } from "../../../logistics/index.js";
import { EmitirAvancoMercadoriaUseCase } from "../../application/use-cases/emitir-avanco-mercadoria.js";
import { EmitirRemessaInicialUseCase } from "../../application/use-cases/emitir-remessa-inicial.js";
import { createRemessasAdapters } from "./remessas-adapters.js";

/**
 * Composition Root do módulo Remessas.
 */
export function createRemessasModule(db: DbClient) {
  const logistics = createLogisticsModule(db);
  const adapters = createRemessasAdapters(db);

  const emitirRemessaInicial = new EmitirRemessaInicialUseCase({
    prisma: db,
    estoqueFifo: adapters.estoqueFifo,
    unidadeLogistica: adapters.unidadeLogistica,
    emitirRemessaLegado: async (_tx, command) => {
      return emitirRemessaManual(db, {
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
    prisma: db,
    estoqueFifo: adapters.estoqueFifo,
    unidadeLogistica: adapters.unidadeLogistica,
    createAdapters: createRemessasAdapters,
    resolverProduto: async (tenantId, productId, productSku) => {
      const resolved = await logistics.resolveAdvanceProduct.execute(
        tenantId,
        productId,
        productSku,
      );
      if (!resolved) return null;
      const product = await db.product.findFirst({
        where: { id: resolved.productId, tenantId },
      });
      if (!product) return null;
      return { product, fifoProductId: resolved.fifoProductId };
    },
  });

  return {
    emitirRemessaInicial,
    emitirAvancoMercadoria,
    adapters,
  };
}
