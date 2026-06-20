import type {
  FiscalValidatorPort,
  NfeValidationResult,
} from "../../domain/ports/fiscal-validator.port.js";

/** In-memory validator for tests. */
export class FakeFiscalValidatorAdapter implements FiscalValidatorPort {
  constructor(private readonly result: NfeValidationResult) {}

  async validateNfe(_xmlContent: string): Promise<NfeValidationResult> {
    return this.result;
  }
}
