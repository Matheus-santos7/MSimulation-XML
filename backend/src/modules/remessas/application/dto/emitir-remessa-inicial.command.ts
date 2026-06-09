export type EmitirRemessaInicialCommand = {
  tenantId: string;
  unidadeDestinoId?: string;
  items: {
    productId: string;
    productSku?: string;
    quantidade: number;
  }[];
};

export type EmitirRemessaInicialResult = {
  nfe: Record<string, unknown>;
  cte: Record<string, unknown>;
};
