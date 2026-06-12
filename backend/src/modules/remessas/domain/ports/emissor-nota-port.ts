import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import type { Product, Tenant } from "../../../../generated/prisma/client.js";
import type { NotaFiscalRascunho } from "../entities/nota-fiscal.js";
import type { CamposDestinoNfe } from "../types/destino-nfe.js";

/**
 * Contexto fiscal compartilhado na preparação de notas do avanço.
 * Inclui tenant, produto, UFs, série de remessa e identificador ML do pedido.
 */
export type ContextoFiscalEmissao = {
  tenant: Tenant;
  product: Product;
  emitUf: string;
  destUf: string;
  pedidoMl: string;
  serie: number;
};

/**
 * Documento fiscal pronto para persistência: rascunho de domínio + metadados
 * tributários e payload XML gerado pelo fiscal-core.
 */
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
 * Port de saída: preparação fiscal das notas do avanço de mercadoria.
 *
 * Implementação (`FiscalEmissorAdapter`) delega a:
 * - Módulo **tax** — resolução de regras e cálculo
 * - **fiscal-core** — montagem do payload NF-e
 * - **fiscal-settings** — `loadEmitterSettings` (composição de base, CST, etc.)
 *
 * Não persiste no banco; apenas produz {@link DocumentoFiscalPreparado}.
 */
export interface EmissorNotaPort {
  /**
   * Prepara retorno simbólico que “devolve” mercadoria do CD origem ao seller
   * (referenciando a remessa FIFO debitada).
   */
  prepararRetornoSimbolicoAvanco(
    tx: PrismaTx,
    ctx: ContextoFiscalEmissao,
    quantidade: number,
    remessaReferencia: { id: string; chave: string },
    unidadeOrigemId: string,
    unidadeDestinoId: string,
  ): Promise<DocumentoFiscalPreparado>;

  /**
   * Prepara remessa simbólico que “reenvia” ao CD destino do avanço.
   * Referencia o retorno simbólico recém-emitido.
   */
  prepararRemessaSimbolicaAvanco(
    tx: PrismaTx,
    ctx: ContextoFiscalEmissao,
    quantidade: number,
    retornoReferencia: { id: string; chave: string },
    unidadeOrigemId: string,
    unidadeDestinoId: string,
  ): Promise<DocumentoFiscalPreparado>;
}
