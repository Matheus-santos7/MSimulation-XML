import { BRAND_FULL_NAME } from "../../../lib/brand.js";
import { escapeHtml } from "../utils.js";

export function buildRegistrationAttemptEmailHtml(params: {
  loginUrl: string;
  forgotPasswordUrl: string;
  recipientName?: string | null;
}): string {
  const greeting = params.recipientName?.trim()
    ? `Olá, ${escapeHtml(params.recipientName.trim())}`
    : "Olá";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tentativa de cadastro — ${escapeHtml(BRAND_FULL_NAME)}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0b;font-family:system-ui,-apple-system,sans-serif;color:#e8e8ea;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0a0b;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#141416;border:1px solid #2a2a2e;border-radius:12px;padding:32px;">
          <tr>
            <td>
              <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#c9a227;">${escapeHtml(BRAND_FULL_NAME)}</p>
              <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#fafafa;">Tentativa de cadastro</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#a1a1aa;">${greeting},</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#a1a1aa;">
                Recebemos uma tentativa de criar uma nova conta usando este endereço de e-mail.
                Se foi você, sua conta já existe — use o botão abaixo para entrar.
              </p>
              <p style="margin:0 0 28px;text-align:center;">
                <a href="${escapeHtml(params.loginUrl)}" style="display:inline-block;background:#c9a227;color:#0a0a0b;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;">
                  Entrar na conta
                </a>
              </p>
              <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#71717a;">
                Se não reconhece esta tentativa, ignore este e-mail ou
                <a href="${escapeHtml(params.forgotPasswordUrl)}" style="color:#c9a227;text-decoration:none;">redefina sua senha</a>
                por segurança.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
