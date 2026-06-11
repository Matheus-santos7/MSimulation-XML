import { BRAND_FULL_NAME } from "../../lib/brand.js";
import { escapeHtml } from "../utils.js";

export function buildPasswordResetEmailHtml(params: {
  resetUrl: string;
  expiresMinutes: number;
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
  <title>Redefinir senha — ${escapeHtml(BRAND_FULL_NAME)}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0b;font-family:system-ui,-apple-system,sans-serif;color:#e8e8ea;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0a0b;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#141416;border:1px solid #2a2a2e;border-radius:12px;padding:32px;">
          <tr>
            <td>
              <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#c9a227;">${escapeHtml(BRAND_FULL_NAME)}</p>
              <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#fafafa;">Redefinir senha</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#a1a1aa;">${greeting},</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#a1a1aa;">
                Recebemos uma solicitação para redefinir a senha da sua conta. O link abaixo expira em
                <strong style="color:#e4e4e7;">${params.expiresMinutes} minutos</strong>.
              </p>
              <p style="margin:0 0 28px;text-align:center;">
                <a href="${escapeHtml(params.resetUrl)}" style="display:inline-block;background:#c9a227;color:#0a0a0b;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;">
                  Redefinir senha
                </a>
              </p>
              <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#71717a;">
                Se o botão não funcionar, copie e cole este endereço no navegador:
              </p>
              <p style="margin:0 0 24px;font-size:12px;line-height:1.5;word-break:break-all;color:#a1a1aa;">
                <a href="${escapeHtml(params.resetUrl)}" style="color:#c9a227;">${escapeHtml(params.resetUrl)}</a>
              </p>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#71717a;">
                Se você não solicitou esta alteração, ignore este e-mail. Sua senha permanece a mesma.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0;font-size:11px;color:#52525b;text-align:center;">
          © ${new Date().getFullYear()} ${escapeHtml(BRAND_FULL_NAME)}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
