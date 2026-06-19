import type { NotaFiscalRascunho } from "../entities/nota-fiscal.js";
import { validarReferenciaFiscal } from "../entities/cadeia-fiscal.js";
import { RemessaDomainError } from "../errors.js";

/** Domain Service: valida regras de amarração fiscal antes da persistência. */
export class ValidadorCadeiaFiscal {
  validarRascunho(rascunho: NotaFiscalRascunho): void {
    const tipoPai = rascunho.referencia?.notaPaiTipo ?? null;
    validarReferenciaFiscal(rascunho.tipo, tipoPai);
  }

  validarSequenciaAvanco(
    remessaReferenciaId: string,
    retorno: NotaFiscalRascunho & { id?: string },
    remessaSimbolica: NotaFiscalRascunho,
  ): void {
    this.validarRascunho(retorno);
    this.validarRascunho(remessaSimbolica);

    if (retorno.referencia?.notaPaiId !== remessaReferenciaId) {
      throw new RemessaDomainError(
        "Retorno simbólico deve referenciar a remessa inicial debitada no FIFO",
      );
    }
    if (remessaSimbolica.referencia?.notaPaiId !== retorno.id) {
      throw new RemessaDomainError(
        "Remessa avanço deve referenciar o retorno simbólico emitido no avanço",
      );
    }
  }
}
