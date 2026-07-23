import type {
  DocumentReturnPort,
  ProcessPhysicalReturnInput,
  ProcessReturnInput,
} from "../../domain/ports/fiscal-document-lifecycle.port.js";

/**
 * Emite **devolução** ou **insucesso de entrega** referenciando uma venda autorizada.
 */
export class ProcessReturnUseCase {
  constructor(private readonly documentReturn: DocumentReturnPort) {}

  execute(input: ProcessReturnInput) {
    return this.documentReturn.processSaleReturn(input);
  }
}

/** Emite **retorno físico** (`RETORNO_FISICO`) referenciando remessa com saldo. */
export class ProcessPhysicalReturnUseCase {
  constructor(private readonly documentReturn: DocumentReturnPort) {}

  execute(input: ProcessPhysicalReturnInput) {
    return this.documentReturn.processPhysicalReturn(input);
  }
}
