import { BRAND_FULL_NAME } from "../brand.js";

/** Chave da API Brevo (apenas servidor). */
export function brevoApiKey(): string | undefined {
  const key = process.env.BREVO_API_KEY?.trim();
  return key && key.length > 0 ? key : undefined;
}

/** E-mail remetente verificado no Brevo. */
export function brevoSenderEmail(): string {
  const email = process.env.BREVO_SENDER_EMAIL?.trim();
  if (email && email.length > 0) return email;
  return "noreply@example.com";
}

/** Nome exibido do remetente nos e-mails transacionais. */
export function brevoSenderName(): string {
  const name = process.env.BREVO_SENDER_NAME?.trim();
  if (name && name.length > 0) return name;
  return BRAND_FULL_NAME;
}
