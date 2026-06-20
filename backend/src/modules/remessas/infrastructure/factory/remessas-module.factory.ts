import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import { emitManualShipment } from "../fiscal/physical-shipment/index.js";
import { createLogisticsModule } from "../../../logistics/index.js";
import { EmitirAvancoMercadoriaUseCase } from "../../application/use-cases/emitir-avanco-mercadoria.js";
import { EmitirRemessaInicialUseCase } from "../../application/use-cases/emitir-remessa-inicial.js";
import { createRemessasAdapters } from "./remessas-adapters.js";

/**
 * Composition Root do módulo Remessas.
 */
export function createRemessasModule() {
  const logistics = createLogisticsModule();
  const adapters = createRemessasAdapters();

  const emitirRemessaInicial = new EmitirRemessaInicialUseCase({
    estoqueFifo: adapters.estoqueFifo,
    unidadeLogistica: adapters.unidadeLogistica,
    emitirRemessaLegado: async (_tx, command) => {
      return emitManualShipment(getDbClient(), {
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
    estoqueFifo: adapters.estoqueFifo,
    unidadeLogistica: adapters.unidadeLogistica,
    resolverProduto: async (tenantId, productId, productSku) => {
      const resolved = await logistics.resolveAdvanceProduct.execute(
        tenantId,
        productId,
        productSku,
      );
      if (!resolved) return null;
      const product = await getDbClient().product.findFirst({
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
