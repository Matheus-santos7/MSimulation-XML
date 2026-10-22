import { Injectable } from "@nestjs/common";
import { getDbClient } from "../../../lib/db/tenant-rls.js";
import { realignRemessaFifoProductIdsBySku } from "./remessa-fifo.js";
import type { AlocacaoFifo } from "./stock-fifo.types.js";

/**
 * Escrita do estoque FIFO usada pelos use cases de emissão. As consultas e débitos de saldo
 * ficam em `remessa-fifo.ts`, compartilhadas com vendas e documentos fiscais.
 */
@Injectable()
export class StockFifoRepository {
  private get db() {
    return getDbClient();
  }

  /** Vincula retorno → remessa debitada (auditoria e estorno no cancelamento). */
  async registerConsumption(retornoNfeId: string, alocacoes: AlocacaoFifo[]): Promise<void> {
    for (const aloc of alocacoes) {
      await this.db.nfeRemessaConsumo.create({
        data: {
          retornoNfeId,
          remessaNfeId: aloc.remessaNfeId,
          nfeItemId: aloc.nfeItemId,
          quantidade: aloc.quantidade,
        },
      });
    }
  }

  /** Atualiza `nfe_itens.product_id` para o cadastro atual do SKU; devolve as linhas corrigidas. */
  async realignProductIdBySku(tenantId: string, sku: string): Promise<number> {
    const result = await realignRemessaFifoProductIdsBySku(this.db, tenantId, sku);

    return result.atualizados;
  }
}
