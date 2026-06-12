export class LogisticsUnitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LogisticsUnitError";
  }
}
