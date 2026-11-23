import { headers } from "next/headers";

/**
 * IP do navegador visto pelo Next. A entrada mais à direita do `X-Forwarded-For` é a gravada pelo
 * proxy de borda (as da esquerda o cliente escolhe); `X-Real-IP` cobre proxy que só grava esse.
 */
export function clientIpFromHeaders(requestHeaders: Pick<Headers, "get">): string | undefined {
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",").at(-1)?.trim();

  return forwarded || requestHeaders.get("x-real-ip")?.trim() || undefined;
}

/**
 * Cabeçalho para as chamadas servidor → backend (FE-5): sem ele o backend vê o IP do servidor do
 * Next e o rate limit de login, cadastro e 2FA vira um balde único para todos os usuários.
 */
export async function forwardedClientIpHeaders(): Promise<Record<string, string>> {
  let ip: string | undefined;
  try {
    ip = clientIpFromHeaders(await headers());
  } catch {
    // Fora de uma requisição (build, script) não há IP de cliente para repassar.
    ip = undefined;
  }

  return ip ? { "X-Forwarded-For": ip } : {};
}
