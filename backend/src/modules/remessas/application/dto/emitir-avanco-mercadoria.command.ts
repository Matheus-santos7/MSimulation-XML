export type EmitirAvancoMercadoriaCommand = {
  tenantId: string;
  productId: string;
  productSku?: string;
  quantidade: number;
  unidadeOrigemId: string;
  unidadeDestinoId: string;
};

/**
 * Resultado do avanço com cadeia fiscal completa:
 * Remessa (FIFO) → Retorno Simbólico → Remessa Simbólica [→ Remessa física destino].
 */
export type EmitirAvancoMercadoriaResult = {
  remessaReferenciaId: string;
  retornoSimbolico: { id: string; chave: string };
  remessaSimbolica: { id: string; chave: string };
  remessaDestino: { id: string; chave: string };
  alocacoesFifo: { remessaNfeId: string; nfeItemId: string; quantidade: number }[];
};
