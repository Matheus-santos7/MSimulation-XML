import { BrevoClient } from "@getbrevo/brevo";
import { brevoApiKey } from "./config.js";

let sharedClient: BrevoClient | null = null;

/**
 * Retorna instância compartilhada do cliente Brevo quando a API key está configurada.
 */
export function getBrevoClient(): BrevoClient | null {
  const apiKey = brevoApiKey();
  if (!apiKey) return null;

  if (!sharedClient) {
    sharedClient = new BrevoClient({ apiKey });
  }

  return sharedClient;
}

/**
 * Reseta o singleton (útil em testes).
 */
export function resetBrevoClientForTests(): void {
  sharedClient = null;
}
