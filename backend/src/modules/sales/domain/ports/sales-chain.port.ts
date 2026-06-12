import type { PrismaClient } from "../../../../generated/prisma/client.js";
import type { SalesChainResult } from "../../application/dto/sales-chain.dto.js";
import type { OrderForEmit } from "../entities/order-for-emit.entity.js";

export interface SalesChainPort {
  emit(prisma: PrismaClient, order: OrderForEmit): Promise<SalesChainResult>;
}
