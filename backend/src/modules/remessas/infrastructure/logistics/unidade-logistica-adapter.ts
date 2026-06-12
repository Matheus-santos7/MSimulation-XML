import type { PrismaClient } from "../../../../generated/prisma/client.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { createLogisticsModule } from "../../../logistics/index.js";
import type {
  UnidadeLogisticaAtiva,
  UnidadeLogisticaPort,
} from "../../domain/ports/unidade-logistica-port.js";

type Db = PrismaClient | PrismaTx;

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
  private readonly logistics;

  constructor(private readonly db: Db) {
    this.logistics = createLogisticsModule(this.db as PrismaClient);
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
