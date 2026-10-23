import type { MarketplaceCode } from "@msimulation-xml/fiscal-core";

export interface NfeListItem {
  [key: string]: unknown;
}

export interface NfeDetail extends NfeListItem {
  cteChaveRef?: string;
  referenciadas: Array<{
    chave: string;
    tipo: string;
    numero: number;
    serie: number;
  }>;
}

export interface NfeXmlResult {
  xml: string;
  source: string;
  filename: string;
}

/** Filtros de GET /nfes. */
export type ListNfesFilter = {
  marketplace?: MarketplaceCode;
};
