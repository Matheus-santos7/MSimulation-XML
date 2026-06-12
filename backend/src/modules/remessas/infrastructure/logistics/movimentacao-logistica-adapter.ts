import type { PrismaClient } from "../../../../generated/prisma/client.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { createLogisticsModule } from "../../../logistics/index.js";
import type {
  MovimentacaoLogisticaPort,
  RegistrarMovimentacaoInput,
} from "../../domain/ports/movimentacao-logistica-port.js";

type Db = PrismaClient | PrismaTx;

export class MovimentacaoLogisticaAdapter implements MovimentacaoLogisticaPort {
  private readonly logistics;

  constructor(private readonly db: Db) {
    this.logistics = createLogisticsModule(this.db as PrismaClient);
  }

  async registrar(input: RegistrarMovimentacaoInput): Promise<void> {
    await this.logistics.registerProductMovement.execute(input, this.db);
  }
}
