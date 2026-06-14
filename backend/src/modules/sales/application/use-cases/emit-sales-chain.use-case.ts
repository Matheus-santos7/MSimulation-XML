import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import type { OrderForEmit } from "../../domain/entities/order-for-emit.entity.js";
import type { SalesChainPort } from "../../domain/ports/sales-chain.port.js";
import type { SalesChainResult } from "../dto/sales-chain.dto.js";

/**
 * Caso de uso fino que delega a emissão completa da cadeia ao port `SalesChainPort`.
 *
 * Usado internamente e por fachadas legadas (`emitirCadeiaVenda`).
 *
 * @param order - Snapshot de emissão com produto, tenant e destinatário
 * @returns Venda, retorno simbólico, CT-e e alocações FIFO
 * @throws {SalesChainError} Validações de negócio da cadeia
 * @throws {SaldoRemessaInsuficienteError} Saldo de remessa insuficiente
 */
export class EmitSalesChainUseCase {
  constructor(private readonly salesChain: SalesChainPort) {}

  execute(order: OrderForEmit): Promise<SalesChainResult> {
    return this.salesChain.emit(getDbClient(), order);
  }
}
