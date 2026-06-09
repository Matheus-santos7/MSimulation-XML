import type { OperacaoFiscalTipo } from "../../../../generated/prisma/client.js";

export type RegistrarMovimentacaoInput = {
  tenantId: string;
  productId: string;
  tipoOperacao: OperacaoFiscalTipo;
  quantidade: number;
  unidadeOrigemId: string;
  unidadeDestinoId: string;
  nfeId: string;
  nfeSecundariaId?: string;
  observacao?: string;
};

/** Porta de saída: histórico logístico (MovimentacaoProduto). */
export interface MovimentacaoLogisticaPort {
  registrar(input: RegistrarMovimentacaoInput): Promise<void>;
}
