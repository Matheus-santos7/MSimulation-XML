import { generateOpaqueToken, hashOpaqueToken } from "./token.js";

export function generateRefreshToken(): string {
  return generateOpaqueToken(48);
}

export function hashRefreshToken(token: string): string {
  return hashOpaqueToken(token);
}
