import type {
  DocumentReturnPort,
  ProcessPhysicalReturnInput,
  ProcessReturnInput,
  ReturnableItemsInput,
} from "../../domain/ports/fiscal-document-lifecycle.port.js";

/**
 * Emite **devolução** (integral ou parcial por item) ou **insucesso de entrega**
 * referenciando uma venda autorizada.
 */
export class ProcessReturnUseCase {
  constructor(private readonly documentReturn: DocumentReturnPort) {}

  execute(input: ProcessReturnInput) {
    return this.documentReturn.processSaleReturn(input);
  }

  /** Linhas da venda com quantidades vendidas, já devolvidas e disponíveis. */
  getReturnableItems(input: ReturnableItemsInput) {
    return this.documentReturn.getReturnableItems(input);
  }
}

/** Emite **retorno físico** (`RETORNO_FISICO`) referenciando remessa com saldo. */
export class ProcessPhysicalReturnUseCase {
  constructor(private readonly documentReturn: DocumentReturnPort) {}

  execute(input: ProcessPhysicalReturnInput) {
    return this.documentReturn.processPhysicalReturn(input);
  }
}
