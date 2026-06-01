import { createHash, randomBytes } from "node:crypto";
import { requirePasswordPepper } from "./config.js";

export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256")
    .update(token + requirePasswordPepper())
    .digest("hex");
}
