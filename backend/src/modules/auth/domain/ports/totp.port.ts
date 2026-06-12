export interface TotpPort {
  generateSecret(): string;
  encryptSecret(secret: string): string;
  decryptSecret(secretEnc: string): string | null;
  verifyCode(secret: string, code: string): Promise<boolean>;
  buildOtpAuthUrl(email: string, secret: string): string;
  readonly issuer: string;
}
