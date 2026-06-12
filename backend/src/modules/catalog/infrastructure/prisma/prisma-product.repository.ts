import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";
import { isPrismaUniqueError } from "../../../../lib/org/db-errors.js";
import type { Product } from "../../domain/entities/product.entity.js";
import { ProductConflictError } from "../../domain/errors/product-conflict.error.js";
import type {
  ProductRepository,
  ProductSkuIndexEntry,
  ProductWriteData,
} from "../../domain/ports/product.repository.js";
import { mapProductFromPrisma } from "./product-prisma.mapper.js";

function isPrismaFkError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2003"
  );
}

export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByTenant(tenantId: string): Promise<Product[]> {
    const rows = await this.prisma.product.findMany({
      where: { tenantId },
      orderBy: { sku: "asc" },
    });
    return rows.map(mapProductFromPrisma);
  }

  async findById(id: string, tenantId: string): Promise<Product | null> {
    const row = await this.prisma.product.findFirst({ where: { id, tenantId } });
    return row ? mapProductFromPrisma(row) : null;
  }

  async getTenantUf(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    return tenant.uf;
  }

  async create(tenantId: string, data: ProductWriteData): Promise<Product> {
    try {
      const row = await this.prisma.product.create({
        data: {
          tenantId,
          sku: data.sku,
          ean: data.ean,
          nome: data.nome,
          ncm: data.ncm,
          cest: data.cest,
          exTipi: data.exTipi,
          origem: data.origem,
          unidade: data.unidade,
          preco: data.preco,
          precoCusto: data.precoCusto,
          estoque: data.estoque,
          taxRuleBaseId: data.taxRuleBaseId,
        },
      });
      return mapProductFromPrisma(row);
    } catch (error) {
      if (isPrismaUniqueError(error)) {
        throw new ProductConflictError("SKU já cadastrado nesta empresa");
      }
      throw error;
    }
  }

  async update(id: string, data: Partial<ProductWriteData>): Promise<Product> {
    try {
      const row = await this.prisma.product.update({
        where: { id },
        data: data as Prisma.ProductUpdateInput,
      });
      return mapProductFromPrisma(row);
    } catch (error) {
      if (isPrismaUniqueError(error)) {
        throw new ProductConflictError("SKU já cadastrado nesta empresa");
      }
      throw error;
    }
  }

  async listSkuIndex(tenantId: string): Promise<Map<string, ProductSkuIndexEntry>> {
    const existing = await this.prisma.product.findMany({
      where: { tenantId },
      select: { id: true, sku: true, estoque: true },
    });
    return new Map(existing.map((product) => [product.sku, { id: product.id, estoque: product.estoque }]));
  }

  async countInvoicedOrders(productId: string): Promise<number> {
    const orders = await this.prisma.pedido.groupBy({
      by: ["status"],
      where: { productId },
      _count: { _all: true },
    });
    return orders.find((order) => order.status === "FATURADO")?._count._all ?? 0;
  }

  async deleteProductAndDraftOrders(productId: string): Promise<void> {
    try {
      await this.prisma.$transaction([
        this.prisma.pedido.deleteMany({ where: { productId, status: "RASCUNHO" } }),
        this.prisma.product.delete({ where: { id: productId } }),
      ]);
    } catch (error) {
      if (isPrismaFkError(error)) {
        throw new ProductConflictError(
          "Não é possível excluir: existem registros vinculados a este produto (pedidos ou movimentações fiscais).",
        );
      }
      throw error;
    }
  }
}
