export type LogisticsUnitImportRow = {
  unidade: string;
  cnpj: string | number;
  inscricaoEstadual?: string | number;
  /** Present when the spreadsheet column exists; `null` clears the stored value. */
  idCadIntTran?: string | number | null;
  logradouro: string;
  numero: string;
  cidade: string;
  uf: string;
  cep: string | number;
};
