import type { NFeTipo } from "../../../../generated/prisma/client.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";

export type RemessaFifoTx = Pick<PrismaTx, "nfeItem" | "nfeRemessaConsumo" | "product" | "nFe">;

export type RemessaFifoPrisma = Pick<
  PrismaTx,
  | "nfeItem"
  | "product"
  | "nFe"
  | "meliUnidadeLogistica"
  | "nfeRemessaConsumo"
  | "tenantUnidadeLogistica"
>;

export type RemessaCdBalanceRow = {
  /** ID do catálogo de CDs (para dropdown da UI). */
  unidadeDestinoId: string;
  /** ID gravado na NF-e (`unidade_destino_id`) — usado no débito FIFO. */
  fifoUnidadeDestinoId: string;
  productId: string;
  saldo: number;
  unidade: {
    codigo: string;
    nome: string;
    uf: string;
  } | null;
};

export type PreviewRemessaFifoVenda = {
  remessaNfeId: string;
  remessaChave: string;
  destUf: string;
};

export type FifoItemRow = {
  id: string;
  nfeId: string;
  saldoDisponivel: number | null;
  nfe?: {
    unidadeDestinoId: string | null;
    destUf?: string;
    tipo?: NFeTipo;
    unidadeDestino: { uf: string; codigo: string } | null;
  };
};

export type NfeRemessaSaldoRow = {
  id: string;
  tipo: NFeTipo;
  quantidade: number;
  productId: string | null;
  itens: Array<{ productId: string }>;
};
