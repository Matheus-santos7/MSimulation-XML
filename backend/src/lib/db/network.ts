import net from "node:net";

/**
 * Tempo máximo por endereço IP no "happy eyeballs" do Node (padrão: 250 ms).
 * Do servidor de produção, o TCP até o Neon leva 225–330 ms: com 250 ms o Node desistia
 * dos 3 IPv4 e falhava com ETIMEDOUT em ~757 ms (503 "Banco de dados indisponível").
 */
export const DB_CONNECT_ATTEMPT_TIMEOUT_MS = 2_500;

export function applyDbNetworkDefaults(): void {
  net.setDefaultAutoSelectFamilyAttemptTimeout(DB_CONNECT_ATTEMPT_TIMEOUT_MS);
}
