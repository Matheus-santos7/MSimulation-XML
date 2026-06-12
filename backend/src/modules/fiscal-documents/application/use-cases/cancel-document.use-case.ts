import type {
  CancelDocumentInput,
  DocumentCancellationPort,
} from "../../domain/ports/fiscal-document-lifecycle.port.js";

/** Cancels an authorized sale NF-e (event 110111) and its symbolic return chain. */
export class CancelDocumentUseCase {
  constructor(private readonly cancellation: DocumentCancellationPort) {}

  execute(input: CancelDocumentInput) {
    return this.cancellation.cancelSale(input);
  }
}
