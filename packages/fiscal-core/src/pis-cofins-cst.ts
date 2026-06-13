import { NFeTipo, type NFeTipoValue } from "./nfe-tipo.js";

/**
 * CST PIS/COFINS no retorno simbólico ML Full — grupo `<PISOutr>`/`<COFINSOutr>` (MOC 7.0).
 * A planilha inbound costuma trazer CST 09 (suspensão) para remessa; no retorno simbólico o ML emite 98.
 */
export const PIS_COFINS_CST_SYMBOLIC_RETURN = "98";

/** Resolve CST PIS/COFINS (2 dígitos) conforme o tipo de operação fiscal. */
export function resolvePisCofinsCstFromSnapshot(
  snapshotSt: string,
  operationTipo?: NFeTipoValue | string,
): string {
  const base = String(snapshotSt).trim().slice(0, 2);
  if (operationTipo === NFeTipo.RETORNO_SIMBOLICO) {
    return PIS_COFINS_CST_SYMBOLIC_RETURN;
  }
  return base;
}
