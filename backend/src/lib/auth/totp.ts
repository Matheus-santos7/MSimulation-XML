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
  return (await verifyTotpCodeTimeStep(secret, code)) !== null;
}

/**
 * Passo TOTP do código válido, ou `null`. Com `afterTimeStep`, recusa código de passo igual ou
 * anterior (replay, S-4).
 */
export async function verifyTotpCodeTimeStep(
  secret: string,
  code: string,
  afterTimeStep?: number | null,
): Promise<number | null> {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return null;
  const result = await verify({
    secret,
    token: normalized,
    ...(afterTimeStep != null && { afterTimeStep }),
  });

  // O `verify` genérico também cobre HOTP; só o resultado TOTP traz `timeStep`.
  return result.valid && "timeStep" in result ? result.timeStep : null;
}
