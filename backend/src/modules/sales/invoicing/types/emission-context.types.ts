/**
 * Contexto derivado na emissão da Sales Chain (valores calculados uma vez por operação).
 *
 * - `valorUnitVenda` / `valorTotalVenda`: preço de tabela × quantidade (NF-e VENDA).
 * - `valorUnitCusto` / `valorTotalCusto`: preço de custo × quantidade (RETORNO SIMBÓLICO).
 * - `pedidoMl`: id do pedido no marketplace (informado ou gerado pelo perfil).
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
