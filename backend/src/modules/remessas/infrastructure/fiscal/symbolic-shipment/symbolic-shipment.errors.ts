/**
 * Symbolic shipment fiscal domain errors.
 */
export class SymbolicShipmentFiscalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SymbolicShipmentFiscalError";
  }
}
