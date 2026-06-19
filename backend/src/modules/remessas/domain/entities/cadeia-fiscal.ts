import { CadeiaFiscalInvalidaError } from "../errors.js";
import { TipoNota } from "../value-objects/tipo-nota.js";

/**
 * Regras de amarração fiscal entre notas do bounded context Remessas.
 *
 * | Tipo filha           | Pai obrigatório        |
 * |----------------------|------------------------|
 * | `REMESSA`            | nenhum (nota raiz)     |
 * | `RETORNO_SIMBOLICO`  | remessa com saldo FIFO |
 * | `REMESSA_AVANCO`     | `RETORNO_SIMBOLICO`    |
 *
 * `REMESSA_SIMBOLICA` (pós-devolução) é emitida no módulo fiscal-documents
 * referenciando `DEVOLUCAO` — fora deste mapa de tipos Remessas.
 */

const RETORNO_PAI_PERMITIDOS = new Set<TipoNota>([TipoNota.REMESSA, TipoNota.REMESSA_AVANCO]);

/** Mapa de referência permitida: tipo filho → tipo pai esperado. */
const REFERENCIA_PERMITIDA: Partial<Record<TipoNota, TipoNota | null>> = {
  [TipoNota.REMESSA]: null,
  [TipoNota.RETORNO_SIMBOLICO]: TipoNota.REMESSA,
  [TipoNota.REMESSA_AVANCO]: TipoNota.RETORNO_SIMBOLICO,
};

/**
 * Retorna o tipo de nota pai exigido para uma nota filha, ou `null` se for nota raiz.
 */
export function tipoPaiObrigatorio(tipoFilha: TipoNota): TipoNota | null {
  return REFERENCIA_PERMITIDA[tipoFilha] ?? null;
}

/**
 * Valida se a referência fiscal filha → pai respeita a cadeia permitida.
 *
 * @throws {CadeiaFiscalInvalidaError} Combinação tipo filha/pai inválida
 */
export function validarReferenciaFiscal(
  tipoFilha: TipoNota,
  tipoPai: TipoNota | null,
): void {
  if (tipoFilha === TipoNota.RETORNO_SIMBOLICO) {
    if (!tipoPai || !RETORNO_PAI_PERMITIDOS.has(tipoPai)) {
      throw new CadeiaFiscalInvalidaError(tipoFilha, tipoPai);
    }
    return;
  }

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
