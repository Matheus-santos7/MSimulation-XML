import { Injectable } from "@nestjs/common";
import { TOTP_ISSUER } from "../../../lib/auth/config.js";
import { decryptTotpSecret, encryptTotpSecret } from "../../../lib/auth/totp-crypto.js";
import { buildTotpUri, generateTotpSecret, verifyTotpCode } from "../../../lib/auth/totp.js";

/** TOTP do 2FA: segredo cifrado no banco, verificação do código e URL otpauth do QR code. */
@Injectable()
export class TotpProvider {
  readonly issuer = TOTP_ISSUER;

  generateSecret(): string {
    return generateTotpSecret();
  }

  encryptSecret(secret: string): string {
    return encryptTotpSecret(secret);
  }

  decryptSecret(secretEnc: string): string | null {
    return decryptTotpSecret(secretEnc);
  }

  verifyCode(secret: string, code: string): Promise<boolean> {
    return verifyTotpCode(secret, code);
  }

  buildOtpAuthUrl(email: string, secret: string): string {
    return buildTotpUri(email, secret);
  }
}
