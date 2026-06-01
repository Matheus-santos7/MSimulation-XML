import { generateSecret as otplibGenerate, generateURI, verify } from "otplib";
import { TOTP_ISSUER } from "./config.js";

export function generateTotpSecret(): string {
  return otplibGenerate();
}

export function buildTotpUri(email: string, secret: string): string {
  return generateURI({
    issuer: TOTP_ISSUER,
    label: email,
    secret,
  });
}

export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const result = await verify({ secret, token: normalized });
  return result.valid;
}
