/**
 * Unidade logística (CD Mercado Livre) ativa no catálogo do tenant.
 * Usada para validar origem/destino do avanço e remessa inicial.
 */
export type UnidadeLogisticaAtiva = {
  id: string;
  codigo: string;
  uf: string;
  nome: string;
};

/**
 * Port de consulta a CDs logísticos (implementado via módulo **logistics**).
 *
 * O ID do catálogo pode divergir do `unidade_destino_id` gravado em NF-es
 * antigas; o FIFO resolve por código quando necessário (`remessa-fifo`).
 */
export interface UnidadeLogisticaPort {
  /**
   * Obtém CD ativo por UUID (dropdown da UI).
   * @returns `null` se inexistente ou inativo
   */
  obterAtiva(tenantId: string, unidadeId: string): Promise<UnidadeLogisticaAtiva | null>;

  /**
   * CD padrão do tenant para remessa inicial (envio seller → CD).
   * @returns `null` se não configurado
   */
  obterPadrao(tenantId: string): Promise<UnidadeLogisticaAtiva | null>;
}
