import type { AlocacaoFifo, LinhaSaldoFifo } from "../entities/linha-saldo-fifo.js";
import { SaldoFifoInsuficienteError } from "../errors.js";
import { quantidadeSaldo, type QuantidadeSaldo } from "../value-objects/quantidade-saldo.js";

export type DebitoFifoResultado = {
  alocacoes: AlocacaoFifo[];
  saldoRestantePorLinha: Map<string, QuantidadeSaldo>;
};

/**
 * Domain Service: alocação FIFO pura (sem I/O).
 * A infraestrutura persiste o resultado via EstoqueFifoRepository.
 */
export class TransferidorSaldoFifo {
  debitar(
    linhas: LinhaSaldoFifo[],
    quantidade: number,
    unidadeDestinoId?: string,
  ): DebitoFifoResultado {
    const qtd = quantidadeSaldo(quantidade);
    const elegiveis = linhas
      .filter((l) => l.saldoDisponivel > 0)
      .filter((l) => !unidadeDestinoId || l.unidadeDestinoId === unidadeDestinoId)
      .sort((a, b) => a.emitidaEm.getTime() - b.emitidaEm.getTime());

    let restante = qtd;
    const alocacoes: AlocacaoFifo[] = [];
    const saldoRestantePorLinha = new Map<string, QuantidadeSaldo>();

    for (const linha of elegiveis) {
      if (restante <= 0) break;
      const consumir = quantidadeSaldo(Math.min(linha.saldoDisponivel, restante));
      if (consumir <= 0) continue;

      alocacoes.push({
        remessaNfeId: linha.remessaNfeId,
        nfeItemId: linha.id,
        quantidade: consumir,
      });
      saldoRestantePorLinha.set(
        linha.id,
        quantidadeSaldo(linha.saldoDisponivel - consumir),
      );
      restante = quantidadeSaldo(restante - consumir);
    }

    if (restante > 0) {
      const disponivel = qtd - restante;
      throw new SaldoFifoInsuficienteError(quantidade, disponivel, unidadeDestinoId);
    }

    return { alocacoes, saldoRestantePorLinha };
  }
}
