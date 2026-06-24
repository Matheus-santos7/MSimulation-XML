import type { PrismaClient } from "../../../../generated/prisma/client.js";
import { CheckoutError } from "../../domain/errors/checkout.error.js";
import { OrderLockedError } from "../../domain/errors/order-locked.error.js";
import type { OrderCheckoutInput } from "../../domain/entities/order-checkout-input.entity.js";
import type { OrderRepository } from "../../domain/ports/order.repository.js";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import {
  buyerToDestColumns,
  discountAndFreightColumns,
  mapOrderForEmitFromPrisma,
  mapOrderFromPrisma,
} from "./order-prisma.mapper.js";

const orderInclude = {
  product: true,
  nfe: { select: { chave: true, numero: true, serie: true, status: true } },
} as const;

/**
 * Implementação Prisma do port {@link OrderRepository}.
 *
 * Persiste pedidos na tabela `pedido`, valida ownership de produto por tenant
 * e mapeia linhas Prisma para entidades de domínio via `order-prisma.mapper`.
 */
export class PrismaOrderRepository implements OrderRepository {
  private get db() {
    return getDbClient();
  }

  /** Lista pedidos do tenant com produto e NF-e vinculada (quando faturado). */
  async listByTenant(tenantId: string) {
    const rows = await this.db.pedido.findMany({
      where: { tenantId },
      include: orderInclude,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });
    return rows.map(mapOrderFromPrisma);
  }

  /** Busca pedido por ID com isolamento por tenant. */
  async findById(tenantId: string, id: string) {
    const row = await this.db.pedido.findFirst({
      where: { id, tenantId },
      include: orderInclude,
    });
    return row ? mapOrderFromPrisma(row) : null;
  }

  /**
   * Carrega snapshot completo para emissão da Sales Chain (produto + tenant + destinatário).
   * Usado por {@link InvoiceOrderUseCase}.
   */
  async findForEmit(tenantId: string, id: string) {
    const row = await this.db.pedido.findFirst({
      where: { id, tenantId },
      include: { product: true, tenant: true },
    });
    return row ? mapOrderForEmitFromPrisma(row) : null;
  }

  /**
   * Cria pedido em `RASCUNHO` após validar que o produto pertence ao tenant.
   * @throws {CheckoutError} Produto inexistente ou de outro tenant
   */
  async createDraft(tenantId: string, input: OrderCheckoutInput) {
    const product = await this.assertProductBelongsToTenant(tenantId, input.productId);
    const row = await this.db.pedido.create({
      data: {
        tenantId,
        productId: product.id,
        quantidade: input.quantidade,
        ...discountAndFreightColumns(input),
        status: "RASCUNHO",
        ...buyerToDestColumns(input.comprador),
      },
      include: orderInclude,
    });
    return mapOrderFromPrisma(row);
  }

  /**
   * Atualiza rascunho; rejeita pedidos já `FATURADO`.
   * @throws {OrderLockedError} Pedido bloqueado para edição
   * @throws {CheckoutError} Produto inválido
   */
  async updateDraft(id: string, tenantId: string, input: OrderCheckoutInput) {
    const existing = await this.db.pedido.findFirst({ where: { id, tenantId } });
    if (!existing) return null;
    if (existing.status === "FATURADO") throw new OrderLockedError();

    const product = await this.assertProductBelongsToTenant(tenantId, input.productId);
    const row = await this.db.pedido.update({
      where: { id },
      data: {
        productId: product.id,
        quantidade: input.quantidade,
        ...discountAndFreightColumns(input),
        ...buyerToDestColumns(input.comprador),
      },
      include: orderInclude,
    });
    return mapOrderFromPrisma(row);
  }

  /** Marca pedido como `FATURADO` e associa NF-e de venda e referência ML. */
  async markInvoiced(id: string, pedidoMl: string, nfeId: string) {
    const row = await this.db.pedido.update({
      where: { id },
      data: { status: "FATURADO", pedidoMl, nfeId },
      include: orderInclude,
    });
    return mapOrderFromPrisma(row);
  }

  /** Remove pedido do tenant; retorna `false` se não existir. */
  async delete(id: string, tenantId: string) {
    const existing = await this.db.pedido.findFirst({ where: { id, tenantId } });
    if (!existing) return false;
    await this.db.pedido.delete({ where: { id } });
    return true;
  }

  /**
   * Garante que o produto existe e pertence ao tenant antes de criar/atualizar pedido.
   * @throws {CheckoutError} Produto não encontrado nesta empresa
   */
  async assertProductBelongsToTenant(tenantId: string, productId: string) {
    const product = await this.db.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) throw new CheckoutError("Produto não encontrado nesta empresa");
    return { id: product.id };
  }

  /**
   * Carrega produto e tenant para checkout direto (sem rascunho).
   * Usado por {@link ProcessCheckoutUseCase}.
   * @throws {CheckoutError} Produto não encontrado nesta empresa
   */
  async loadCheckoutContext(tenantId: string, productId: string) {
    const product = await this.db.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) throw new CheckoutError("Produto não encontrado nesta empresa");
    const tenant = await this.db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    return { product, tenant };
  }
}
