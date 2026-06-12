import type {
  DocumentReturnPort,
  ProcessReturnInput,
} from "../../domain/ports/fiscal-document-lifecycle.port.js";

/** Emits a return NF-e (DEVOLUÇÃO) referencing an original sale. */
export class ProcessReturnUseCase {
  constructor(private readonly documentReturn: DocumentReturnPort) {}

  execute(input: ProcessReturnInput) {
    return this.documentReturn.processSaleReturn(input);
  }
}
