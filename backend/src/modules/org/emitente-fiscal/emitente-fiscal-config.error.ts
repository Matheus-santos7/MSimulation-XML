/**
 * Configuração de emitente fiscal inválida (série ausente, filial do papel apagada).
 * Erro de domínio, sem status HTTP: quem emite decide a resposta (o logistics responde 400).
 */
export class EmitenteFiscalConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmitenteFiscalConfigError";
  }
}
