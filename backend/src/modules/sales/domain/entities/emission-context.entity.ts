/**
 * Contexto derivado na emissão da Sales Chain (valores calculados uma vez por operação).
 *
 * - `valorUnitVenda` / `valorTotalVenda`: preço de tabela × quantidade (NF-e VENDA).
 * - `valorUnitCusto` / `valorTotalCusto`: preço de custo × quantidade (RETORNO SIMBÓLICO).
 * - `pedidoMl`: identificador interno estilo Mercado Livre gerado na emissão.
 */
export type EmissionContext = {
  serie: number;
  pedidoMl: string;
  emitidaEm: Date;
  valorUnitVenda: number;
  valorTotalVenda: number;
  valorUnitCusto: number;
  valorTotalCusto: number;
  ruleBaseId: string;
};
