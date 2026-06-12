import type {
  CancelDocumentInput,
  DocumentCancellationPort,
} from "../../domain/ports/fiscal-document-lifecycle.port.js";

/**
 * Cancela NF-e de **VENDA** autorizada e a cadeia simbólica associada.
 *
 * Fluxo de negócio (evento SEFAZ 110111 simulado):
 * 1. Valida: tipo VENDA, status `AUTORIZADA`, prazo de cancelamento, sem devolução prévia
 * 2. Cancela **RETORNO_SIMBOLICO** referenciado (se existir) e estorna saldo FIFO
 * 3. Regista cancelamento na NF-e de venda
 * 4. Cancela CT-e de venda vinculado
 *
 * @param input - `tenantId`, chave da NF-e (`nfeKey`) e justificativa opcional (mín. 15 chars)
 * @returns `{ venda, retorno?, saldoEstornado }`
 * @throws {DocumentCancellationError} 404 NF-e inexistente; 409 já cancelada ou com devolução; 422 tipo/prazo inválido
 */
export class CancelDocumentUseCase {
  constructor(private readonly cancellation: DocumentCancellationPort) {}

  execute(input: CancelDocumentInput) {
    return this.cancellation.cancelSale(input);
  }
}
