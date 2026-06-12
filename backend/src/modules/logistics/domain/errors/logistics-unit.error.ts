/**
 * Erro de validação ou estado inválido de unidade logística (HTTP 400).
 *
 * Ex.: CD inativo, destino não encontrado, ausência de CD padrão para remessa.
 */
export class LogisticsUnitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LogisticsUnitError";
  }
}
