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
  cte: {
    id: string;
    chave: string;
    numero: number;
    serie: number;
    origem: string;
    destino: string;
  };
  alocacoesFifo: { remessaNfeId: string; nfeItemId: string; quantidade: number }[];
};
