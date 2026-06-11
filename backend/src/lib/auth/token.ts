import { createHash, randomBytes } from "node:crypto";
import { requirePasswordPepper } from "./config.js";

/** Gera token opaco URL-safe (refresh, verificação de e-mail, reset de senha). */
export function generateOpaqueToken(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Hash SHA-256 do token com pepper e namespace.
 * Formato: `namespace:token:pepper`
 */
export function hashOpaqueToken(token: string, namespace: string): string {
  const pepper = requirePasswordPepper();
  return createHash("sha256").update(`${namespace}:${token}:${pepper}`).digest("hex");
}
