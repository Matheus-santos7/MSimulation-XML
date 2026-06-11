/** Claims do JWT de acesso (Bearer). */
export type AccessTokenPayload = {
  userId: string;
  tenantId: string | null;
  tokenVersion: number;
  typ: "access";
};

/** Claims do JWT temporário entre login e verificação 2FA. */
export type TwoFactorPendingPayload = {
  userId: string;
  tokenVersion: number;
  typ: "2fa_pending";
};
