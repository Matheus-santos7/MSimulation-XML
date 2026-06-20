/** Domain error for NF-e cancellation (SEFAZ event 110111). */
export class DocumentCancellationError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "DocumentCancellationError";
  }
}

