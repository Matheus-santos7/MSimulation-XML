import { createHash, randomBytes } from "node:crypto";
import { requirePasswordPepper } from "./config.js";

/** Gera token opaco URL-safe (refresh, verificação de e-mail, reset de senha). */
export function generateOpaqueToken(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Hash SHA-256 do token com pepper.
 * @param namespace Quando informado, usa formato `namespace:token:pepper` (ex.: password-reset).
 */
export function hashOpaqueToken(token: string, namespace?: string): string {
  const pepper = requirePasswordPepper();
  const input = namespace ? `${namespace}:${token}:${pepper}` : token + pepper;
  return createHash("sha256").update(input).digest("hex");
}
