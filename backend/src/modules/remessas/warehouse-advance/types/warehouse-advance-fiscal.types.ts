import type { MarketplaceCode } from "@msimulation-xml/fiscal-core";
import type { Product, Tenant } from "../../../../generated/prisma/client.js";
import type { NotaFiscalRascunho } from "../../fiscal-chain/fiscal-chain.types.js";
import type { CamposDestinoNfe } from "../../fiscal-chain/types/destino-nfe.types.js";

/**
 * Contexto fiscal compartilhado na preparação de notas do avanço.
 * Inclui tenant, marketplace dos CDs, produto, UFs, série de remessa e id do pedido.
 */
export type ContextoFiscalEmissao = {
  tenant: Tenant;
  marketplace: MarketplaceCode;
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
