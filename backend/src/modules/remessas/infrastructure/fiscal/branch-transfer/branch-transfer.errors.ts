/**
 * Domain error for branch transfer operations.
 *
 * Thrown when validating or emitting branch transfer NFe + automatic shipment to default warehouse.
 */
export class BranchTransferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BranchTransferError";
  }
}