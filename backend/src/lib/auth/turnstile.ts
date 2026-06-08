import { turnstileSecretKey } from "./config.js";

type TurnstileVerifyResponse = {
  success: boolean;
  "error-codes"?: string[];
};

export class CaptchaVerificationError extends Error {
  constructor(message = "Verificação de segurança falhou. Tente novamente.") {
    super(message);
    this.name = "CaptchaVerificationError";
  }
}

/** Valida token Cloudflare Turnstile. Em dev sem secret, aceita ausência do token. */
export async function verifyTurnstileToken(token: string | undefined, remoteIp?: string): Promise<void> {
  const secret = turnstileSecretKey();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new CaptchaVerificationError("CAPTCHA não configurado no servidor");
    }
    return;
  }

  if (!token || token.trim().length < 10) {
    throw new CaptchaVerificationError();
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });
  if (remoteIp) body.set("remoteip", remoteIp);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new CaptchaVerificationError();
  }

  const data = (await res.json()) as TurnstileVerifyResponse;
  if (!data.success) {
    throw new CaptchaVerificationError();
  }
}
