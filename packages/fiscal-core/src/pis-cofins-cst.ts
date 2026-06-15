import { NFeTipo, type NFeTipoValue } from "./nfe-tipo.js";

/**
 * CST PIS/COFINS no retorno simbólico ML Full — grupo `<PISOutr>`/`<COFINSOutr>` (MOC 7.0).
 * A planilha inbound costuma trazer CST 09 (suspensão) para remessa; no retorno simbólico o ML emite 98.
 */
export const PIS_COFINS_CST_SYMBOLIC_RETURN = "98";

/** CST IPI no retorno simbólico ML Full (entrada com suspensão — `<IPINT>` CST 05). */
export const IPI_CST_SYMBOLIC_RETURN = "05";

/**
 * CST ICMS no retorno simbólico ML Full — suspensão (grupo ICMS40/ICMS50 sem vBC).
 * Evita CST 00 com pICMS zerado em operações de armazenagem.
 */
export const ICMS_CST_SYMBOLIC_RETURN = "50";

const ML_DEFAULT_MOD_FRETE: Record<NFeTipoValue, string> = {
  VENDA: "9",
  REMESSA: "0",
  RETORNO_SIMBOLICO: "9",
  REMESSA_SIMBOLICA: "2",
  DEVOLUCAO: "9",
  TRANSFERENCIA_FILIAL: "2",
};

function pickTaxStCode(snapshotSt: string): string {
  return String(snapshotSt).trim().slice(0, 2);
}

/** Resolve CST PIS/COFINS (2 dígitos) conforme o tipo de operação fiscal. */
export function resolvePisCofinsCstFromSnapshot(
  snapshotSt: string,
  operationTipo?: NFeTipoValue | string,
): string {
  if (operationTipo === NFeTipo.RETORNO_SIMBOLICO) {
    return PIS_COFINS_CST_SYMBOLIC_RETURN;
  }
  return pickTaxStCode(snapshotSt);
}

/** Resolve CST IPI (2 dígitos) conforme o tipo de operação fiscal. */
export function resolveIpiCstFromSnapshot(
  snapshotSt: string,
  operationTipo?: NFeTipoValue | string,
): string {
  if (operationTipo === NFeTipo.RETORNO_SIMBOLICO) {
    return IPI_CST_SYMBOLIC_RETURN;
  }
  return pickTaxStCode(snapshotSt);
}

/** Resolve CST ICMS (2 dígitos) conforme o tipo de operação fiscal. */
export function resolveIcmsCstFromSnapshot(
  snapshotSt: string,
  operationTipo?: NFeTipoValue | string,
): string {
  if (operationTipo === NFeTipo.RETORNO_SIMBOLICO) {
    return ICMS_CST_SYMBOLIC_RETURN;
  }
  return pickTaxStCode(snapshotSt);
}

/** Modalidade de frete padrão ML quando settings estão em modo DEFAULT. */
export function resolveDefaultModFreteForTipo(tipo: NFeTipoValue): string {
  return ML_DEFAULT_MOD_FRETE[tipo] ?? "0";
}
