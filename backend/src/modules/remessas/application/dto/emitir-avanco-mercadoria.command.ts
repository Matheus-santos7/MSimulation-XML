export type EmitirAvancoMercadoriaCommand = {
  tenantId: string;
  productId: string;
  productSku?: string;
  quantidade: number;
  unidadeOrigemId: string;
  unidadeDestinoId: string;
};

/**
 * Resultado do avanço: Remessa (FIFO) → Retorno Simbólico → Remessa Simbólica.
 * O saldo fica na remessa simbólica no CD destino (sem nova remessa física).
 */
export type EmitirAvancoMercadoriaResult = {
  remessaReferenciaId: string;
  retornoSimbolico: { id: string; chave: string };
  remessaSimbolica: { id: string; chave: string };
  alocacoesFifo: { remessaNfeId: string; nfeItemId: string; quantidade: number }[];
};
