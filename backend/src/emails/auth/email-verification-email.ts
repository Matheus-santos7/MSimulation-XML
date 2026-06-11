import { BRAND_FULL_NAME } from "../../lib/brand.js";

export function buildEmailVerificationEmailHtml(params: {
  verifyUrl: string;
  expiresHours: number;
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
  <title>Confirmar e-mail — ${escapeHtml(BRAND_FULL_NAME)}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0b;font-family:system-ui,-apple-system,sans-serif;color:#e8e8ea;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0a0b;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#141416;border:1px solid #2a2a2e;border-radius:12px;padding:32px;">
          <tr>
            <td>
              <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#c9a227;">${escapeHtml(BRAND_FULL_NAME)}</p>
              <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#fafafa;">Confirmar e-mail</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#a1a1aa;">${greeting},</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#a1a1aa;">
                Confirme seu endereço de e-mail para ativar sua conta. O link expira em
                ${params.expiresHours} hora(s).
              </p>
              <p style="margin:0 0 24px;">
                <a href="${escapeHtml(params.verifyUrl)}" style="display:inline-block;background:#c9a227;color:#0a0a0b;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">Confirmar e-mail</a>
              </p>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#71717a;">
                Se você não criou esta conta, ignore este e-mail.
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
