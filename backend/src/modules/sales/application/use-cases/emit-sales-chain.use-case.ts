import type { PrismaClient } from "../../../../generated/prisma/client.js";
import type { OrderForEmit } from "../../domain/entities/order-for-emit.entity.js";
import type { SalesChainPort } from "../../domain/ports/sales-chain.port.js";

export class EmitSalesChainUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly salesChain: SalesChainPort,
  ) {}

  execute(order: OrderForEmit) {
    return this.salesChain.emit(this.prisma, order);
  }
}
