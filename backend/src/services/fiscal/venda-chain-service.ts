/**
 * Emissão da cadeia de venda no fulfillment — venda simples).
 *
 * ```
 * REMESSA (já existente, saldo FIFO)
 *    ↑ nfeReferenciaId
 * RETORNO_SIMBOLICO  ← debita saldo via remessa-fifo.ts
 *    ↑ nfeReferenciaId
 * VENDA              ← refNFe no XML aponta para o retorno
 * CT-e (venda)       ← vinculado à NF-e de venda
 * ```
 *
 * Implementação modular em `venda-chain/`:
 * - `resolver-regras.ts` — planilha sale + inbound
 * - `emit-retorno.ts` — NF-e retorno + FIFO
 * - `emit-venda.ts` — NF-e venda
 * - `emit-cadeia.ts` — orquestrador (`$transaction`)
 *
 * @see remessa-fifo.ts — consumo e tabela `nfe_remessa_consumos`
 * @see devolucao-service.ts — fluxo inverso (devolução + estorno)
 * @see cancelamento-service.ts — cancela venda + retorno e estorna FIFO
 */

export { emitirCadeiaVenda } from "./venda-chain/emit-cadeia.js";
export { VendaChainError, type PedidoForEmit } from "./venda-chain/types.js";
