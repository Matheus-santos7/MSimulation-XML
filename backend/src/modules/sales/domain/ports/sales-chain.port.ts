import type { PrismaClient } from "../../../../generated/prisma/client.js";
import type { SalesChainResult } from "../../application/dto/sales-chain.dto.js";
import type { OrderForEmit } from "../entities/order-for-emit.entity.js";

/**
 * Port da orquestração fiscal de venda (cadeia completa).
 *
 * Implementação: {@link SalesChainOrchestrator} em `infrastructure/fiscal/`.
 */
export interface SalesChainPort {
  /**
   * Emite retorno simbólico → venda → CT-e em transação única.
   *
   * @param prisma - Cliente Prisma (transação aberta internamente)
   * @param order - Snapshot `OrderForEmit` (checkout ou pedido faturado)
   * @returns Documentos emitidos e alocações FIFO
   * @throws {SalesChainError} Validações de negócio
   * @throws {SaldoRemessaInsuficienteError} Saldo de remessa insuficiente
   */
  emit(prisma: PrismaClient, order: OrderForEmit): Promise<SalesChainResult>;
}
