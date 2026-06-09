import type { PrismaClient } from "../../../../generated/prisma/client.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { registrarMovimentacaoProduto } from "../../../../services/logistics/movimentacao-produto-service.js";
import type {
  MovimentacaoLogisticaPort,
  RegistrarMovimentacaoInput,
} from "../../domain/ports/movimentacao-logistica-port.js";

type Db = PrismaClient | PrismaTx;

export class MovimentacaoLogisticaAdapter implements MovimentacaoLogisticaPort {
  constructor(private readonly db: Db) {}

  async registrar(input: RegistrarMovimentacaoInput): Promise<void> {
    await registrarMovimentacaoProduto(this.db, input);
  }
}
