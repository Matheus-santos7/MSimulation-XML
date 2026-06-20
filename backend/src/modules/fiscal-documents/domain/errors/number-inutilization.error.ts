/** Domain error for unused NF-e number range inutilization (procInutNFe). */
export class NumberInutilizationError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "NumberInutilizationError";
  }
}

