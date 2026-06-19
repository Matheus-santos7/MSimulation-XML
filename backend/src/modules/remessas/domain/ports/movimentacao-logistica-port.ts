import type { OperacaoFiscalTipo } from "../../../../generated/prisma/client.js";

/**
 * Registro de movimentação logística após conclusão do avanço.
 * Persistido em `movimentacoes_produto` pelo módulo **logistics**.
 */
export type RegistrarMovimentacaoInput = {
  tenantId: string;
  productId: string;
  tipoOperacao: OperacaoFiscalTipo;
  quantidade: number;
  unidadeOrigemId: string;
  unidadeDestinoId: string;
  /** NF-e principal da operação (remessa avanço no CD destino). */
  nfeId: string;
  nfeSecundariaId?: string;
  observacao?: string;
};

/**
 * Port de histórico logístico — rastreabilidade operacional além do FIFO fiscal.
 *
 * Chamado **após** a transação fiscal do avanço, para não bloquear rollback
 * da emissão em caso de falha no registro de movimentação.
 */
export interface MovimentacaoLogisticaPort {
  registrar(input: RegistrarMovimentacaoInput): Promise<void>;
}
