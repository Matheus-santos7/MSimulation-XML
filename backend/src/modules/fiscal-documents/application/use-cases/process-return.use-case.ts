import type {
  DocumentReturnPort,
  ProcessReturnInput,
} from "../../domain/ports/fiscal-document-lifecycle.port.js";

/**
 * Emite **devolução** (NF-e `DEVOLUCAO`) referenciando uma venda autorizada.
 *
 * Fluxo de negócio (cadeia ML Full):
 * 1. Valida venda `AUTORIZADA`, sem devolução duplicada, com produto vinculado
 * 2. Emite NF-e DEVOLUÇÃO espelhando impostos da venda (referencia `saleNfeKey`)
 * 3. Estorna consumo FIFO do retorno simbólico da cadeia original
 * 4. Opcionalmente emite **REMESSA_SIMBOLICA** de reposição (quando há remessa física na cadeia)
 *
 * A NF-e de venda **permanece AUTORIZADA**; o estado de negócio passa a "com devolução".
 *
 * @param input - `tenantId` e chave da NF-e de venda (`saleNfeKey`)
 * @returns `{ devolucao, remessaSimbolica?, saldoEstornado }`
 * @throws {DocumentReturnError} 404 venda não encontrada; 409 devolução já existente; 422 tipo inválido
 */
export class ProcessReturnUseCase {
  constructor(private readonly documentReturn: DocumentReturnPort) {}

  execute(input: ProcessReturnInput) {
    return this.documentReturn.processSaleReturn(input);
  }
}
