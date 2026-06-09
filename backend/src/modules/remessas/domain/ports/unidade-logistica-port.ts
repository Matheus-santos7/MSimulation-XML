export type UnidadeLogisticaAtiva = {
  id: string;
  codigo: string;
  uf: string;
  nome: string;
};

export interface UnidadeLogisticaPort {
  obterAtiva(tenantId: string, unidadeId: string): Promise<UnidadeLogisticaAtiva | null>;

  obterPadrao(tenantId: string): Promise<UnidadeLogisticaAtiva | null>;
}
