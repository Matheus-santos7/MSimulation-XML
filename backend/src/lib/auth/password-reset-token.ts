import { generateOpaqueToken, hashOpaqueToken } from "./token.js";

const NAMESPACE = "password-reset";

export function generatePasswordResetToken(): string {
  return generateOpaqueToken(32);
}

export function hashPasswordResetToken(token: string): string {
  return hashOpaqueToken(token, NAMESPACE);
}
