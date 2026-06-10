import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import type { Product, Tenant } from "../../../../generated/prisma/client.js";
import type { NotaFiscalRascunho } from "../entities/nota-fiscal.js";
import type { CamposDestinoNfe } from "../types/destino-nfe.js";

export type ContextoFiscalEmissao = {
  tenant: Tenant;
  product: Product;
  emitUf: string;
  destUf: string;
  pedidoMl: string;
  serie: number;
};

export type DocumentoFiscalPreparado = {
  rascunho: NotaFiscalRascunho;
  numero: number;
  chave: string;
  natOp: string;
  cfop: string;
  valor: number;
  valorIcms: number;
  aliqIcms: number;
  fiscalPayload: unknown;
  destino: CamposDestinoNfe;
};

/**
 * Porta de saída: preparação fiscal (regras, tributos, payload XML).
 * Implementação delega a tax-calculation-service e fiscal-core.
 */
export interface EmissorNotaPort {
  prepararRetornoSimbolicoAvanco(
    tx: PrismaTx,
    ctx: ContextoFiscalEmissao,
    quantidade: number,
    remessaReferencia: { id: string; chave: string },
    unidadeOrigemId: string,
    unidadeDestinoId: string,
  ): Promise<DocumentoFiscalPreparado>;

  prepararRemessaSimbolicaAvanco(
    tx: PrismaTx,
    ctx: ContextoFiscalEmissao,
    quantidade: number,
    retornoReferencia: { id: string; chave: string },
    unidadeOrigemId: string,
    unidadeDestinoId: string,
  ): Promise<DocumentoFiscalPreparado>;
}
