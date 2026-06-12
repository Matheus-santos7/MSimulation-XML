export type SendPasswordResetEmailParams = {
  to: string;
  resetUrl: string;
  expiresMinutes: number;
  recipientName?: string | null;
  idempotencyKey: string;
};

export type SendEmailVerificationParams = {
  to: string;
  verifyUrl: string;
  expiresHours: number;
  recipientName?: string | null;
  idempotencyKey: string;
};

export interface EmailSenderPort {
  sendPasswordReset(params: SendPasswordResetEmailParams): Promise<void>;
  sendEmailVerification(params: SendEmailVerificationParams): Promise<void>;
}
