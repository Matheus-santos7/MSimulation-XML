import type { PrismaClient } from "../../../../generated/prisma/client.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import type { EmissorNotaPort } from "../../domain/ports/emissor-nota-port.js";
import type { EstoqueFifoRepository } from "../../domain/ports/estoque-fifo-repository.js";
import type { MovimentacaoLogisticaPort } from "../../domain/ports/movimentacao-logistica-port.js";
import type { NotaFiscalRepository } from "../../domain/ports/nota-fiscal-repository.js";
import type { UnidadeLogisticaPort } from "../../domain/ports/unidade-logistica-port.js";
import { FiscalEmissorAdapter } from "../fiscal/fiscal-emissor-adapter.js";
import { MovimentacaoLogisticaAdapter } from "../logistics/movimentacao-logistica-adapter.js";
import { UnidadeLogisticaAdapter } from "../logistics/unidade-logistica-adapter.js";
import { PrismaEstoqueFifoRepository } from "../prisma/prisma-estoque-fifo-repository.js";
import { PrismaNotaFiscalRepository } from "../prisma/prisma-nota-fiscal-repository.js";

export type RemessasAdapters = {
  estoqueFifo: EstoqueFifoRepository;
  notaFiscal: NotaFiscalRepository;
  emissorNota: EmissorNotaPort;
  unidadeLogistica: UnidadeLogisticaPort;
  movimentacao: MovimentacaoLogisticaPort;
};

export function createRemessasAdapters(db: PrismaClient | PrismaTx): RemessasAdapters {
  return {
    estoqueFifo: new PrismaEstoqueFifoRepository(db),
    notaFiscal: new PrismaNotaFiscalRepository(db),
    emissorNota: new FiscalEmissorAdapter(db),
    unidadeLogistica: new UnidadeLogisticaAdapter(db),
    movimentacao: new MovimentacaoLogisticaAdapter(db),
  };
}
