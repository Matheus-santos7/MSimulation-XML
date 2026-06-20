/**
 * Physical shipment module public API.
 *
 * Exports English-named symbols for internal use across modules.
 */
export { ShipmentError } from "./physical-shipment.errors.js";
export type {
  EmitShipmentOptions,
  ManualShipmentItemInput,
  PhysicalShipmentLineInput,
} from "./physical-shipment.types.js";
export { mapShipmentDestinationToNfeFields } from "./physical-shipment-destination.mapper.js";
export { buildPhysicalShipmentTaxLines } from "./physical-shipment-tax-lines.js";
export {
  emitShipmentNfe,
  emitShipmentWithItems,
  emitShipmentNfeWithItems,
} from "./physical-shipment-core.js";
export { emitManualShipment } from "./physical-shipment-manual.js";
