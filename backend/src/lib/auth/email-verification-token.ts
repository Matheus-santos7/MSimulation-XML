import { createHash, randomBytes } from "node:crypto";
import { requirePasswordPepper } from "./config.js";

export function generateEmailVerificationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashEmailVerificationToken(token: string): string {
  return createHash("sha256")
    .update(token + requirePasswordPepper())
    .digest("hex");
}
