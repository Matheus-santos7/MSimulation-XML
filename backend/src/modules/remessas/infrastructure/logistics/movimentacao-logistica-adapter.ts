import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import { createLogisticsModule } from "../../../logistics/index.js";
import type {
  MovimentacaoLogisticaPort,
  RegistrarMovimentacaoInput,
} from "../../domain/ports/movimentacao-logistica-port.js";

export class MovimentacaoLogisticaAdapter implements MovimentacaoLogisticaPort {
  private get logistics() {
    return createLogisticsModule();
  }

  async registrar(input: RegistrarMovimentacaoInput): Promise<void> {
    await this.logistics.registerProductMovement.execute(input, getDbClient());
  }
}
