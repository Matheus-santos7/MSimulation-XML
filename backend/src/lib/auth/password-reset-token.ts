import { createHash, randomBytes } from "node:crypto";
import { requirePasswordPepper } from "./config.js";

export function generatePasswordResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256")
    .update(`password-reset:${token}:${requirePasswordPepper()}`)
    .digest("hex");
}
