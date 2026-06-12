import type { PrismaClient } from "../../../../generated/prisma/client.js";
import { CheckoutError } from "../../domain/errors/checkout.error.js";
import { OrderLockedError } from "../../domain/errors/order-locked.error.js";
import type { OrderCheckoutInput } from "../../domain/entities/order-checkout-input.entity.js";
import type { OrderRepository } from "../../domain/ports/order.repository.js";
import {
  buyerToDestColumns,
  mapOrderForEmitFromPrisma,
  mapOrderFromPrisma,
} from "./order-prisma.mapper.js";

const orderInclude = {
  product: true,
  nfe: { select: { chave: true, numero: true, serie: true, status: true } },
} as const;

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByTenant(tenantId: string) {
    const rows = await this.prisma.pedido.findMany({
      where: { tenantId },
      include: orderInclude,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });
    return rows.map(mapOrderFromPrisma);
  }

  async findById(tenantId: string, id: string) {
    const row = await this.prisma.pedido.findFirst({
      where: { id, tenantId },
      include: orderInclude,
    });
    return row ? mapOrderFromPrisma(row) : null;
  }

  async findForEmit(tenantId: string, id: string) {
    const row = await this.prisma.pedido.findFirst({
      where: { id, tenantId },
      include: { product: true, tenant: true },
    });
    return row ? mapOrderForEmitFromPrisma(row) : null;
  }

  async createDraft(tenantId: string, input: OrderCheckoutInput) {
    const product = await this.assertProductBelongsToTenant(tenantId, input.productId);
    const row = await this.prisma.pedido.create({
      data: {
        tenantId,
        productId: product.id,
        quantidade: input.quantidade,
        status: "RASCUNHO",
        ...buyerToDestColumns(input.comprador),
      },
      include: orderInclude,
    });
    return mapOrderFromPrisma(row);
  }

  async updateDraft(id: string, tenantId: string, input: OrderCheckoutInput) {
    const existing = await this.prisma.pedido.findFirst({ where: { id, tenantId } });
    if (!existing) return null;
    if (existing.status === "FATURADO") throw new OrderLockedError();

    const product = await this.assertProductBelongsToTenant(tenantId, input.productId);
    const row = await this.prisma.pedido.update({
      where: { id },
      data: {
        productId: product.id,
        quantidade: input.quantidade,
        ...buyerToDestColumns(input.comprador),
      },
      include: orderInclude,
    });
    return mapOrderFromPrisma(row);
  }

  async markInvoiced(id: string, pedidoMl: string, nfeId: string) {
    const row = await this.prisma.pedido.update({
      where: { id },
      data: { status: "FATURADO", pedidoMl, nfeId },
      include: orderInclude,
    });
    return mapOrderFromPrisma(row);
  }

  async delete(id: string, tenantId: string) {
    const existing = await this.prisma.pedido.findFirst({ where: { id, tenantId } });
    if (!existing) return false;
    await this.prisma.pedido.delete({ where: { id } });
    return true;
  }

  async assertProductBelongsToTenant(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) throw new CheckoutError("Produto não encontrado nesta empresa");
    return { id: product.id };
  }

  async loadCheckoutContext(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) throw new CheckoutError("Produto não encontrado nesta empresa");
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    return { product, tenant };
  }
}
