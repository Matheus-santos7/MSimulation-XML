/**
 * Devolução parcial de venda — cálculo do que ainda pode ser devolvido por linha
 * (`nItem` da venda) e validação do pedido do operador.
 *
 * Domínio puro (sem Prisma). A venda pode receber várias devoluções até esgotar
 * as quantidades; devoluções legadas (sem `NfeItem`) eram sempre integrais e
 * contam como tal.
 */

import type { DevolucaoItemPedido } from "../../../tax/domain/services/mirror-origin-for-devolucao.js";

/** Linha (`<det>`) da NF-e de venda. */
export type SaleReturnLine = {
  numeroItem: number;
  productId: string;
  quantidade: number;
};

/** Devolução/insucesso já emitido para a venda. `itens` vazio = devolução legada integral. */
export type PriorReturnNote = {
  itens: Array<{ productId: string; quantidade: number }>;
};

export type ReturnableLine = SaleReturnLine & {
  quantidadeDevolvida: number;
  quantidadeDisponivel: number;
};

/** Linha validada a devolver nesta operação. */
export type RequestedReturnLine = SaleReturnLine;

export class DevolucaoItensError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "DevolucaoItensError";
  }
}

/**
 * Quanto de cada linha da venda já foi devolvido e quanto ainda resta.
 *
 * O devolvido é agregado por produto (o FIFO e os `NfeItem` das devoluções são
 * por produto) e distribuído nas linhas da venda na ordem do `nItem`.
 */
export function computeReturnableLines(
  lines: SaleReturnLine[],
  priorReturns: PriorReturnNote[],
): ReturnableLine[] {
  const returnedByProduct = new Map<string, number>();
  const add = (productId: string, qty: number) =>
    returnedByProduct.set(productId, (returnedByProduct.get(productId) ?? 0) + qty);

  for (const prior of priorReturns) {
    if (prior.itens.length === 0) {
      for (const line of lines) add(line.productId, line.quantidade);
      continue;
    }
    for (const item of prior.itens) add(item.productId, item.quantidade);
  }

  return lines.map((line) => {
    const pending = returnedByProduct.get(line.productId) ?? 0;
    const devolvida = Math.min(line.quantidade, Math.max(0, pending));
    returnedByProduct.set(line.productId, pending - devolvida);
    return {
      ...line,
      quantidadeDevolvida: devolvida,
      quantidadeDisponivel: line.quantidade - devolvida,
    };
  });
}

/**
 * Resolve o que devolver nesta operação.
 * Sem `requested` (ou vazio) → tudo que resta. Lança `DevolucaoItensError`
 * 409 quando nada resta e 422 para pedidos inválidos.
 */
export function resolveRequestedReturnLines(
  available: ReturnableLine[],
  requested?: DevolucaoItemPedido[],
): RequestedReturnLine[] {
  const remaining = available.filter((line) => line.quantidadeDisponivel > 0);
  if (remaining.length === 0) {
    throw new DevolucaoItensError("Venda já devolvida integralmente.", 409);
  }

  if (!requested || requested.length === 0) {
    return remaining.map(({ numeroItem, productId, quantidadeDisponivel }) => ({
      numeroItem,
      productId,
      quantidade: quantidadeDisponivel,
    }));
  }

  const byNumero = new Map(available.map((line) => [line.numeroItem, line]));
  const seen = new Set<number>();
  const result: RequestedReturnLine[] = [];

  for (const pedido of requested) {
    if (seen.has(pedido.numeroItem)) {
      throw new DevolucaoItensError(
        `Item ${pedido.numeroItem} informado mais de uma vez.`,
        422,
      );
    }
    seen.add(pedido.numeroItem);

    const line = byNumero.get(pedido.numeroItem);
    if (!line) {
      throw new DevolucaoItensError(
        `Item ${pedido.numeroItem} não existe na NF-e de venda.`,
        422,
      );
    }
    if (!Number.isInteger(pedido.quantidade) || pedido.quantidade <= 0) {
      throw new DevolucaoItensError(
        `Quantidade do item ${pedido.numeroItem} deve ser um inteiro maior que zero.`,
        422,
      );
    }
    if (pedido.quantidade > line.quantidadeDisponivel) {
      throw new DevolucaoItensError(
        `Item ${pedido.numeroItem}: quantidade ${pedido.quantidade} acima do disponível ${line.quantidadeDisponivel} (vendida ${line.quantidade}, devolvida ${line.quantidadeDevolvida}).`,
        422,
      );
    }
    result.push({
      numeroItem: line.numeroItem,
      productId: line.productId,
      quantidade: pedido.quantidade,
    });
  }

  return result.sort((a, b) => a.numeroItem - b.numeroItem);
}
