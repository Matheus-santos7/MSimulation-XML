/** Domain error for sale return (NF-e DEVOLUÇÃO) emission. */
export class DocumentReturnError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "DocumentReturnError";
  }
}

/** @deprecated Use DocumentReturnError */
export { DocumentReturnError as DevolucaoError };
