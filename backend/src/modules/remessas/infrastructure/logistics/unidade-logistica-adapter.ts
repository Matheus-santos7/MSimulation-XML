import { createLogisticsModule } from "../../../logistics/index.js";
import type {
  UnidadeLogisticaAtiva,
  UnidadeLogisticaPort,
} from "../../domain/ports/unidade-logistica-port.js";

function mapUnidade(row: {
  id: string;
  codigo: string;
  uf: string;
  nome: string;
}): UnidadeLogisticaAtiva {
  return {
    id: row.id,
    codigo: row.codigo,
    uf: row.uf,
    nome: row.nome,
  };
}

export class UnidadeLogisticaAdapter implements UnidadeLogisticaPort {
  private get logistics() {
    return createLogisticsModule();
  }

  async obterAtiva(tenantId: string, unidadeId: string): Promise<UnidadeLogisticaAtiva | null> {
    const row = await this.logistics.getActiveLogisticsUnit.execute(unidadeId);
    return row ? mapUnidade(row) : null;
  }

  async obterPadrao(tenantId: string): Promise<UnidadeLogisticaAtiva | null> {
    const destination = await this.logistics.resolveShipmentDestination.execute(tenantId);
    return mapUnidade({
      id: destination.unitId,
      codigo: destination.codigo,
      uf: destination.uf,
      nome: destination.nome,
    });
  }
}
