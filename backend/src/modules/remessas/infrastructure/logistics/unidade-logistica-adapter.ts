import type { PrismaClient } from "../../../../generated/prisma/client.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import {
  getUnidadeAtivaDoTenant,
  UnidadeLogisticaService,
} from "../../../../services/logistics/unidade-logistica-service.js";
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
  constructor(private readonly db: Db) {}

  async obterAtiva(tenantId: string, unidadeId: string): Promise<UnidadeLogisticaAtiva | null> {
    const row = await getUnidadeAtivaDoTenant(
      this.db as PrismaClient,
      tenantId,
      unidadeId,
    );
    return row ? mapUnidade(row) : null;
  }

  async obterPadrao(tenantId: string): Promise<UnidadeLogisticaAtiva | null> {
    const service = new UnidadeLogisticaService(this.db as PrismaClient);
    const { unidade } = await service.resolveDestinoRemessa(tenantId);
    return unidade ? mapUnidade(unidade) : null;
  }
}
