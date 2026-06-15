import { generateOpaqueToken, hashOpaqueToken } from "../../../../lib/auth/token.js";

export function generateEmailVerificationToken(): string {
  return generateOpaqueToken(32);
}

export function hashEmailVerificationToken(token: string): string {
  return hashOpaqueToken(token, "email-verify");
}
