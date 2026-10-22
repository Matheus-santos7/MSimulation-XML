/**
 * Movimentação de produto (Product Movement) — registo operacional de stock fiscal.
 *
 * Cada linha em `movimentacao_produto` liga um produto a uma NF-e (`nfeId`),
 * opcionalmente a unidades de origem/destino e a uma NF-e secundária (ex.: retorno
 * no avanço de mercadoria).
 *
 * Tipos comuns (`tipoOperacao`): remessa física, avanço entre CDs (`AVANCO_CD`), etc.
 * Usado para timeline e auditoria no frontend.
 */
export type ProductMovement = {
  id: string;
  tipoOperacao: string;
  quantidade: number;
  unidadeOrigemId?: string;
  unidadeDestinoId?: string;
  unidadeOrigem?: { codigo: string; nome: string };
  unidadeDestino?: { codigo: string; nome: string };
  nfeId: string;
  nfeSecundariaId?: string;
  nfe?: { chave: string; tipo: string; numero: number; serie: number };
  nfeSecundaria?: { chave: string; tipo: string; numero: number; serie: number };
  observacao?: string;
  createdAt: string;
};
