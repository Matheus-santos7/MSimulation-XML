/**
 * Produto resolvido para avanço de mercadoria entre CDs.
 *
 * `productId` — ID do produto no catálogo do tenant (emissão fiscal).
 * `fifoProductId` — ID usado nas linhas FIFO de remessa (pode diferir após realinhamento por SKU).
 */
export type AdvanceProductResolved = {
  productId: string;
  fifoProductId: string;
  sku: string;
  tenantId: string;
};
