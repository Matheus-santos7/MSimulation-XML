import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { requirePasswordPepper } from "./config.js";

function scryptDerive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, SCRYPT_COST, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

const ALGORITHM = "scrypt";
const SALT_BYTES = 16;
const KEY_BYTES = 64;
/** N=16384 — compatível com limite de memória do OpenSSL em Node (Render/Vercel). */
const SCRYPT_COST = { N: 16384, r: 8, p: 1, maxmem: 128 * 1024 * 1024 } as const;

/** Hash inválido usado para equalizar tempo de resposta quando o e-mail não existe. */
export const DUMMY_PASSWORD_HASH =
  "scrypt$000102030405060708090a0b0c0d0e0f$000102030405060708090a0b0c0d0e0f000102030405060708090a0b0c0d0e0f000102030405060708090a0b0c0d0e0f00";

function pepper(): string {
  return requirePasswordPepper();
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptDerive(plain + pepper(), salt);
  return `${ALGORITHM}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!isPasswordHashed(stored)) {
    return false;
  }

  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== ALGORITHM) return false;

  const salt = Buffer.from(parts[1]!, "hex");
  const expected = Buffer.from(parts[2]!, "hex");
  if (salt.length === 0 || expected.length === 0) return false;

  const derived = await scryptDerive(plain + pepper(), salt);
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}

export function isPasswordHashed(stored: string): boolean {
  return stored.startsWith(`${ALGORITHM}$`);
}

/** Atraso artificial após falha de login (anti enumeração por tempo). */
export function authFailureDelay(): Promise<void> {
  const ms = 200 + Math.floor(Math.random() * 150);
  return new Promise((resolve) => setTimeout(resolve, ms));
}
