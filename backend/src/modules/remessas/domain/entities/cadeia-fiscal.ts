import { CadeiaFiscalInvalidaError } from "../errors.js";
import { TipoNota } from "../value-objects/tipo-nota.js";

/** Mapa de referência permitida: tipo filho → tipo pai esperado. */
const REFERENCIA_PERMITIDA: Partial<Record<TipoNota, TipoNota | null>> = {
  [TipoNota.REMESSA]: null,
  [TipoNota.RETORNO_SIMBOLICO]: TipoNota.REMESSA,
  [TipoNota.REMESSA_SIMBOLICA]: TipoNota.RETORNO_SIMBOLICO,
};

export function tipoPaiObrigatorio(tipoFilha: TipoNota): TipoNota | null {
  return REFERENCIA_PERMITIDA[tipoFilha] ?? null;
}

export function validarReferenciaFiscal(
  tipoFilha: TipoNota,
  tipoPai: TipoNota | null,
): void {
  const esperado = tipoPaiObrigatorio(tipoFilha);

  if (esperado === null) {
    if (tipoPai !== null) {
      throw new CadeiaFiscalInvalidaError(tipoFilha, tipoPai);
    }
    return;
  }

  if (tipoPai !== esperado) {
    throw new CadeiaFiscalInvalidaError(tipoFilha, tipoPai);
  }
}
