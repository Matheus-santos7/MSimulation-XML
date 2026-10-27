import { Injectable } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma/client.js";
import { isPrismaUniqueError } from "../../../lib/db/prisma-errors.js";
import { runInTransaction } from "../../../lib/db/prisma-tx.js";
import type { Product } from "./product.types.js";
import { CatalogError } from "../errors/catalog.errors.js";
import type { ProductSkuIndexEntry, ProductWriteData } from "./types/product-write.types.js";
import { mapProductFromPrisma } from "./product.mapper.js";
import { getDbClient } from "../../../lib/db/tenant-rls.js";

function isPrismaFkError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2003"
  );
}

/** Produtos da empresa. Toda leitura filtra por `tenantId` (além da RLS). */
@Injectable()
export class ProductRepository {
  private get db() {
    return getDbClient();
  }

  async listByTenant(tenantId: string): Promise<Product[]> {
    const rows = await this.db.product.findMany({
      where: { tenantId },
      orderBy: { sku: "asc" },
    });
    return rows.map(mapProductFromPrisma);
  }

  async findById(id: string, tenantId: string): Promise<Product | null> {
    const row = await this.db.product.findFirst({ where: { id, tenantId } });
    return row ? mapProductFromPrisma(row) : null;
  }

  async getTenantUf(tenantId: string): Promise<string> {
    const tenant = await this.db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    return tenant.uf;
  }

  async create(tenantId: string, data: ProductWriteData): Promise<Product> {
    try {
      const row = await this.db.product.create({
        data: {
          tenantId,
          sku: data.sku,
          ean: data.ean,
          nome: data.nome,
          ncm: data.ncm,
          cest: data.cest ?? null,
          exTipi: data.exTipi,
          nfci: data.nfci,
          origem: data.origem,
          unidade: data.unidade,
          preco: data.preco,
          precoCusto: data.precoCusto,
          estoque: data.estoque,
          sujeitoSt: data.sujeitoSt === true,
          taxRuleBaseId: data.taxRuleBaseId,
        },
      });
      return mapProductFromPrisma(row);
    } catch (error) {
      if (isPrismaUniqueError(error)) {
        throw new CatalogError.ProductConflict("SKU já cadastrado nesta empresa");
      }
      throw error;
    }
  }

  async update(id: string, data: Partial<ProductWriteData>): Promise<Product> {
    try {
      const row = await this.db.product.update({
        where: { id },
        data: data as Prisma.ProductUpdateInput,
      });
      return mapProductFromPrisma(row);
    } catch (error) {
      if (isPrismaUniqueError(error)) {
        throw new CatalogError.ProductConflict("SKU já cadastrado nesta empresa");
      }
      throw error;
    }
  }

  async listSkuIndex(tenantId: string): Promise<Map<string, ProductSkuIndexEntry>> {
    const existing = await this.db.product.findMany({
      where: { tenantId },
      select: { id: true, sku: true, estoque: true },
    });
    return new Map(
      existing.map((product) => [product.sku, { id: product.id, estoque: product.estoque }]),
    );
  }

  async countInvoicedOrders(productId: string): Promise<number> {
    const items = await this.db.pedidoItem.groupBy({
      by: ["pedidoId"],
      where: {
        productId,
        pedido: { status: "FATURADO" },
      },
      _count: { _all: true },
    });
    return items.length;
  }

  async deleteProductAndDraftOrders(productId: string): Promise<void> {
    try {
      await runInTransaction(this.db, async (tx) => {
        const draftItems = await tx.pedidoItem.findMany({
          where: { productId, pedido: { status: "RASCUNHO" } },
          select: { pedidoId: true },
        });
        const draftPedidoIds = [...new Set(draftItems.map((item) => item.pedidoId))];
        if (draftPedidoIds.length > 0) {
          await tx.pedido.deleteMany({ where: { id: { in: draftPedidoIds } } });
        }
        await tx.product.delete({ where: { id: productId } });
      });
    } catch (error) {
      if (isPrismaFkError(error)) {
        throw new CatalogError.ProductConflict(
          "Não é possível excluir: existem registros vinculados a este produto (pedidos ou movimentações fiscais).",
        );
      }
      throw error;
    }
  }
}
