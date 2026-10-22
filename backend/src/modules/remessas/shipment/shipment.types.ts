/** Remessa física pedida pela tela de movimentações (POST /movimentacoes/remessa). */
export type ShipmentEmitCommand = {
  tenantId: string;
  /** CD de destino; sem ele vale o CD padrão da empresa. */
  unidadeDestinoId?: string;
  items: {
    productId: string;
    productSku?: string;
    quantidade: number;
  }[];
};

export type ShipmentEmitResult = {
  nfe: Record<string, unknown>;
  cte: Record<string, unknown>;
};
