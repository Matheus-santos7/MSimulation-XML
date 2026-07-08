import type { PrismaClient } from "../../../../generated/prisma/client.js";
import { CheckoutError } from "../../domain/errors/checkout.error.js";
import { OrderLockedError } from "../../domain/errors/order-locked.error.js";
import type { OrderCheckoutInput } from "../../domain/entities/order-checkout-input.entity.js";
import type { OrderRepository } from "../../domain/ports/order.repository.js";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import { runInTransaction } from "../../../../lib/db/prisma-tx.js";
import {
  buyerToDestColumns,
  discountAndFreightColumns,
  mapOrderForEmitFromPrisma,
  mapOrderFromPrisma,
} from "./order-prisma.mapper.js";

const pedidoItemInclude = {
  product: true,
} as const;

const orderInclude = {
  itens: {
    include: pedidoItemInclude,
    orderBy: { numeroItem: "asc" as const },
  },
  nfe: { select: { chave: true, numero: true, serie: true, status: true } },
} as const;

/**
 * Implementação Prisma do port {@link OrderRepository}.
 *
 * Persiste pedidos na tabela `pedido` com linhas em `pedido_itens`, valida
 * ownership de produto por tenant e mapeia linhas Prisma para entidades de domínio.
 */
export class PrismaOrderRepository implements OrderRepository {
  private get db() {
    return getDbClient();
  }

  /** Lista pedidos do tenant com itens e NF-e vinculada (quando faturado). */
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
   * Carrega snapshot completo para emissão da Sales Chain (itens + tenant + destinatário).
   * Usado por {@link InvoiceOrderUseCase}.
   */
  async findForEmit(tenantId: string, id: string) {
    const row = await this.db.pedido.findFirst({
      where: { id, tenantId },
      include: {
        itens: { include: pedidoItemInclude, orderBy: { numeroItem: "asc" } },
        tenant: true,
      },
    });
    return row ? mapOrderForEmitFromPrisma(row) : null;
  }

  /**
   * Cria pedido em `RASCUNHO` com todos os itens informados.
   *
   * @throws {CheckoutError} Produto inexistente ou de outro tenant, input sem itens
   */
  async createDraft(tenantId: string, input: OrderCheckoutInput) {
    if (input.items.length === 0) {
      throw new CheckoutError("Pedido deve conter ao menos um item");
    }

    const products = await this.assertProductsBelongToTenant(
      tenantId,
      input.items.map((item) => item.productId),
    );
    const productById = new Map(products.map((product) => [product.id, product]));

    const row = await this.db.pedido.create({
      data: {
        tenantId,
        status: "RASCUNHO",
        ...buyerToDestColumns(input.comprador),
        itens: {
          create: input.items.map((item, index) => ({
            productId: productById.get(item.productId)!.id,
            numeroItem: index + 1,
            quantidade: item.quantidade,
            ...discountAndFreightColumns(item),
          })),
        },
      },
      include: orderInclude,
    });
    return mapOrderFromPrisma(row);
  }

  /**
   * Atualiza rascunho; rejeita pedidos já `FATURADO`.
   *
   * @throws {OrderLockedError} Pedido bloqueado para edição
   * @throws {CheckoutError} Produto inválido ou ausência de itens
   */
  async updateDraft(id: string, tenantId: string, input: OrderCheckoutInput) {
    const existing = await this.db.pedido.findFirst({ where: { id, tenantId } });
    if (!existing) return null;
    if (existing.status === "FATURADO") throw new OrderLockedError();

    if (input.items.length === 0) {
      throw new CheckoutError("Pedido deve conter ao menos um item");
    }

    const products = await this.assertProductsBelongToTenant(
      tenantId,
      input.items.map((item) => item.productId),
    );
    const productById = new Map(products.map((product) => [product.id, product]));

    const row = await runInTransaction(this.db, async (tx) => {
      await tx.pedidoItem.deleteMany({ where: { pedidoId: id } });
      return tx.pedido.update({
        where: { id },
        data: {
          ...buyerToDestColumns(input.comprador),
          itens: {
            create: input.items.map((item, index) => ({
              productId: productById.get(item.productId)!.id,
              numeroItem: index + 1,
              quantidade: item.quantidade,
              ...discountAndFreightColumns(item),
            })),
          },
        },
        include: orderInclude,
      });
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
   * Garante que todos os produtos existem e pertencem ao tenant.
   *
   * @throws {CheckoutError} Produto não encontrado nesta empresa
   */
  async assertProductsBelongToTenant(tenantId: string, productIds: string[]) {
    const uniqueIds = [...new Set(productIds)];
    const products = await this.db.product.findMany({
      where: { tenantId, id: { in: uniqueIds } },
    });
    if (products.length !== uniqueIds.length) {
      throw new CheckoutError("Produto não encontrado nesta empresa");
    }
    return products.map((product) => ({ id: product.id }));
  }

  /**
   * Carrega produtos e tenant para checkout direto (sem rascunho).
   *
   * @throws {CheckoutError} Produto não encontrado nesta empresa
   */
  async loadCheckoutContext(tenantId: string, productIds: string[]) {
    const uniqueIds = [...new Set(productIds)];
    const products = await this.db.product.findMany({
      where: { tenantId, id: { in: uniqueIds } },
    });
    if (products.length !== uniqueIds.length) {
      throw new CheckoutError("Produto não encontrado nesta empresa");
    }

    const tenant = await this.db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const productById = new Map(products.map((product) => [product.id, product]));
    return {
      products: uniqueIds.map((id) => productById.get(id)!),
      tenant,
    };
  }
}
