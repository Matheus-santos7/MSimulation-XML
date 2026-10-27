import type { MarketplaceCode } from "@msimulation-xml/fiscal-core";
import type { Tenant } from "../../../../generated/prisma/client.js";
import type { NotaFiscalRascunho } from "../fiscal-chain.types.js";
import type { CamposDestinoNfe } from "./destino-nfe.types.js";

/**
 * Dados necessários para gravar NF-e após preparação fiscal.
 * Estende o rascunho de domínio com campos obrigatórios do Prisma/SEFAZ.
 */
export type PersistirNotaInput = NotaFiscalRascunho & {
  marketplace: MarketplaceCode;
  numero: number;
  chave: string;
  fiscalPayload: unknown;
  valor: number;
  valorIcms: number;
  aliqIcms: number;
  natOp: string;
  cfop: string;
  ncm: string;
  pedidoMl: string;
  destino: CamposDestinoNfe;
};

/** Geração do XML autorizado de uma nota já gravada. */
export type PersistXmlFromEmissionInput = {
  nfeId: string;
  tenant: Tenant;
  productId: string;
  marketplace: MarketplaceCode;
  /** Chave(s) da(s) nota(s) pai para `<NFref>`. */
  nfeReferenciaChave?: string | string[];
};
