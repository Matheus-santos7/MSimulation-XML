const EXPIRY_SAFETY_MARGIN_MS = 30_000;

/**
 * Lê só o `exp` do JWT, sem validar assinatura. Serve para decidir se vale a pena chamar
 * `/auth/me` antes de uma leitura: o token continua sendo apenas repassado como Bearer e o
 * backend valida assinatura em toda chamada.
 */
export function isAccessTokenFresh(token: string, nowMs: number = Date.now()): boolean {
  const payload = token.split(".")[1];
  if (!payload) return false;

  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp?: unknown;
    };

    return typeof exp === "number" && exp * 1000 - nowMs > EXPIRY_SAFETY_MARGIN_MS;
  } catch {
    return false;
  }
}
