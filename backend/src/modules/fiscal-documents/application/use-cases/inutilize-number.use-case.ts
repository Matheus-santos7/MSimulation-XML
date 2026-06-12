import type {
  InutilizeNumberInput,
  NumberInutilizationPort,
} from "../../domain/ports/fiscal-document-lifecycle.port.js";

/** Inutilizes an unused NF-e number range (procInutNFe). */
export class InutilizeNumberUseCase {
  constructor(private readonly inutilization: NumberInutilizationPort) {}

  execute(input: InutilizeNumberInput) {
    return this.inutilization.inutilizeRange(input);
  }
}
