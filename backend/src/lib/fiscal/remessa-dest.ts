/** Destinatário padrão ML — depósito temporário (modelo NF-e remessa 6949). */
export const REMESSA_ML_DEST = {
  cnpj: "03007331012077",
  nome: "EBAZAR.COM.BR LTDA",
  ie: "261755994",
  logradouro: "Av. Papenborg",
  numero: "S/N",
  complemento: "Nao consta",
  bairro: "Guaporanga",
  codigoMunicipio: "4206009",
  municipio: "Governador Celso Ramos",
  uf: "SC",
  cep: "88190000",
  codigoPais: 1058,
  nomePais: "Brasil",
  indIeDest: 1,
} as const;

export const REMESSA_ML_INTERMED = {
  cnpj: "03007331000141",
  idCadIntTran: "279642028",
} as const;

export const REMESSA_NAT_OP = "Outras Saidas - Remessa para Deposito Temporario";
/** Interestadual — 1º dígito 6, alinhado a idDest=2. */
export const REMESSA_CFOP_INTERSTATE = "6949";
/** Intrastadual — 1º dígito 5, alinhado a idDest=1. */
export const REMESSA_CFOP_INTRASTATE = "5949";
/** @deprecated Use {@link resolveRemessaCfop} — mantido para compatibilidade. */
export const REMESSA_CFOP = REMESSA_CFOP_INTERSTATE;
export const REMESSA_INF_CPL = "Remessa para Deposito Temporario.";

/** CFOP da remessa física conforme UF emitente × UF destinatário (SEFAZ rejeição 770/522). */
export function resolveRemessaCfop(emitUf: string, destUf: string): string {
  return emitUf.toUpperCase().trim() === destUf.toUpperCase().trim()
    ? REMESSA_CFOP_INTRASTATE
    : REMESSA_CFOP_INTERSTATE;
}
