import type { PrismaClient } from "../../../../generated/prisma/client.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { RemessaDomainError } from "../../domain/errors.js";
import { criarRemessaInicial } from "../../domain/entities/nota-fiscal.js";
import type { EstoqueFifoRepository } from "../../domain/ports/estoque-fifo-repository.js";
import type { UnidadeLogisticaPort } from "../../domain/ports/unidade-logistica-port.js";
import { ValidadorCadeiaFiscal } from "../../domain/services/validador-cadeia-fiscal.js";
import type {
  EmitirRemessaInicialCommand,
  EmitirRemessaInicialResult,
} from "../dto/emitir-remessa-inicial.command.js";

export type EmitirRemessaInicialDeps = {
  prisma: PrismaClient;
  estoqueFifo: EstoqueFifoRepository;
  unidadeLogistica: UnidadeLogisticaPort;
  emitirRemessaLegado: (
    tx: PrismaTx,
    command: EmitirRemessaInicialCommand & { unidadeDestinoId: string },
  ) => Promise<EmitirRemessaInicialResult>;
};

/**
 * Caso de uso: Remessa Inicial (envio ao CD padrão, sem referência fiscal).
 */
export class EmitirRemessaInicialUseCase {
  private readonly validador = new ValidadorCadeiaFiscal();

  constructor(private readonly deps: EmitirRemessaInicialDeps) {}

  async execute(command: EmitirRemessaInicialCommand): Promise<EmitirRemessaInicialResult> {
    if (command.items.length === 0) {
      throw new RemessaDomainError("Informe ao menos um produto na remessa inicial");
    }

    const unidadeDestinoId =
      command.unidadeDestinoId ??
      (await this.deps.unidadeLogistica.obterPadrao(command.tenantId))?.id;

    if (!unidadeDestinoId) {
      throw new RemessaDomainError("Defina o CD padrão antes de emitir a remessa inicial");
    }

    for (const item of command.items) {
      const rascunho = criarRemessaInicial({
        tenantId: command.tenantId,
        productId: item.productId,
        serie: 0,
        quantidade: item.quantidade,
        unidadeOrigemId: null,
        unidadeDestinoId,
      });
      this.validador.validarRascunho(rascunho);

      if (item.productSku?.trim()) {
        await this.deps.estoqueFifo.realinharProductIdPorSku(command.tenantId, item.productSku);
      }
    }

    return this.deps.emitirRemessaLegado(
      this.deps.prisma as unknown as PrismaTx,
      { ...command, unidadeDestinoId },
    );
  }
}
