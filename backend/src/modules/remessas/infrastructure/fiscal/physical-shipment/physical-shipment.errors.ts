/**
 * Domain errors for physical shipment operations.
 */
export class ShipmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShipmentError";
  }
}
