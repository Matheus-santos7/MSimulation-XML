/**
 * Portuguese transit barrel for backward compatibility.
 *
 * Re-exports English-named symbols from physical-shipment/ with PT aliases.
 * New code should import from physical-shipment/index.ts directly.
 *
 * @deprecated Use physical-shipment/index.ts with English names
 */
import type {
  EmitShipmentOptions,
  ManualShipmentItemInput,
  PhysicalShipmentLineInput,
} from "./physical-shipment/index.js";
import {
  ShipmentError,
  emitManualShipment,
  emitShipmentNfe,
  emitShipmentWithItems,
} from "./physical-shipment/index.js";

// PT type aliases
export type EmitirRemessaOptions = EmitShipmentOptions;
export type RemessaManualItemInput = ManualShipmentItemInput;
export type RemessaLinhaInput = PhysicalShipmentLineInput;

// PT function aliases
export { ShipmentError as RemessaError };
export { emitManualShipment as emitirRemessaManual };
export { emitShipmentNfe as emitirNFeRemessa };
export { emitShipmentWithItems as emitirRemessaComItens };

// Re-export org errors
export { EmitenteFiscalConfigError } from "../../../org/index.js";
