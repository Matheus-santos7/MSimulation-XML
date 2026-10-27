/**
 * Linha de planilha ML para importação em massa de unidades logísticas.
 *
 * Campos espelham o export Meli Full; `idCadIntTran` opcional limpa valor armazenado quando `null`.
 */
export type LogisticsUnitImportRow = {
  unidade: string;
  cnpj: string | number;
  inscricaoEstadual?: string | number;
  /** Presente quando a coluna existe na planilha; `null` limpa o valor guardado. */
  idCadIntTran?: string | number | null;
  logradouro: string;
  numero: string;
  cidade: string;
  uf: string;
  cep: string | number;
};
