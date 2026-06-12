import { CadeiaFiscalInvalidaError } from "../errors.js";
import { TipoNota } from "../value-objects/tipo-nota.js";

/**
 * Regras de amarração fiscal entre notas do bounded context Remessas.
 *
 * Define qual tipo de nota **filha** pode referenciar qual tipo **pai** na
 * cadeia fulfillment ML Full. Violações lançam {@link CadeiaFiscalInvalidaError}.
 *
 * | Tipo filha           | Pai obrigatório      |
 * |----------------------|----------------------|
 * | `REMESSA`            | nenhum (nota raiz)   |
 * | `RETORNO_SIMBOLICO`  | `REMESSA` ou remessa simbólica debitada |
 * | `REMESSA_SIMBOLICA`  | `RETORNO_SIMBOLICO`  |
 */

/** Mapa de referência permitida: tipo filho → tipo pai esperado. */
const REFERENCIA_PERMITIDA: Partial<Record<TipoNota, TipoNota | null>> = {
  [TipoNota.REMESSA]: null,
  [TipoNota.RETORNO_SIMBOLICO]: TipoNota.REMESSA,
  [TipoNota.REMESSA_SIMBOLICA]: TipoNota.RETORNO_SIMBOLICO,
};

/**
 * Retorna o tipo de nota pai exigido para uma nota filha, ou `null` se for nota raiz.
 *
 * @param tipoFilha - Tipo da nota que está sendo emitida
 */
export function tipoPaiObrigatorio(tipoFilha: TipoNota): TipoNota | null {
  return REFERENCIA_PERMITIDA[tipoFilha] ?? null;
}

/**
 * Valida se a referência fiscal filha → pai respeita a cadeia permitida.
 *
 * @param tipoFilha - Tipo da nota emitida
 * @param tipoPai - Tipo da nota referenciada (`null` quando não há referência)
 * @throws {CadeiaFiscalInvalidaError} Combinação tipo filha/pai inválida
 */
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
