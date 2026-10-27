import { BRAND_FULL_NAME } from "../brand.js";
import { appConfig } from "../../config/config.service.js";

/** Chave da API Brevo (apenas servidor). */
export function brevoApiKey(): string | undefined {
  const key = appConfig.brevoApiKey?.trim();
  return key && key.length > 0 ? key : undefined;
}

/** E-mail remetente verificado no Brevo. */
export function brevoSenderEmail(): string {
  const email = appConfig.brevoSenderEmail?.trim();
  if (email && email.length > 0) return email;
  return "noreply@example.com";
}

/** Nome exibido do remetente nos e-mails transacionais. */
export function brevoSenderName(): string {
  const name = appConfig.brevoSenderName?.trim();
  if (name && name.length > 0) return name;
  return BRAND_FULL_NAME;
}
