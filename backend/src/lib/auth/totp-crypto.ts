import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { requirePasswordPepper } from "./config.js";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

function encryptionKey(): Buffer {
  return createHash("sha256").update(`totp:${requirePasswordPepper()}`).digest();
}

export function encryptTotpSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptTotpSecret(stored: string): string | null {
  const parts = stored.split(":");
  if (parts.length !== 3) return null;
  try {
    const iv = Buffer.from(parts[0]!, "hex");
    const tag = Buffer.from(parts[1]!, "hex");
    const data = Buffer.from(parts[2]!, "hex");
    const decipher = createDecipheriv(ALGO, encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
