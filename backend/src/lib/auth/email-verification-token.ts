import { generateOpaqueToken, hashOpaqueToken } from "./token.js";

export function generateEmailVerificationToken(): string {
  return generateOpaqueToken(32);
}

export function hashEmailVerificationToken(token: string): string {
  return hashOpaqueToken(token);
}
