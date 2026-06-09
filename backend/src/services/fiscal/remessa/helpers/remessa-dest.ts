/**
 * Constantes e helpers da NF-e de remessa física.
 *
 * Destinatário da remessa vem sempre da unidade logística (CD) da empresa —
 * ver `UnidadeLogisticaService.resolveDestinoRemessa`.
 */
export const REMESSA_NAT_OP = "Outras Saidas - Remessa para Deposito Temporario";
/** Interestadual — 1º dígito 6, alinhado a idDest=2. */
export const REMESSA_CFOP_INTERSTATE = "6949";
/** Intrastadual — 1º dígito 5, alinhado a idDest=1. */
export const REMESSA_CFOP_INTRASTATE = "5949";

/** CFOP da remessa física conforme UF emitente × UF destinatário (SEFAZ rejeição 770/522). */
export function resolveRemessaCfop(emitUf: string, destUf: string): string {
  return emitUf.toUpperCase().trim() === destUf.toUpperCase().trim()
    ? REMESSA_CFOP_INTRASTATE
    : REMESSA_CFOP_INTERSTATE;
}
