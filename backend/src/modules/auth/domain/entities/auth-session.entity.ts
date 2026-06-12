import type { TenantSummary, UserRole } from "./user.entity.js";

/**
 * Payload do JWT de acesso (`typ: "access"`).
 * Validado pelo `authPlugin` em rotas protegidas.
 */
export type AccessTokenPayload = {
  userId: string;
  tenantId: string | null;
  tokenVersion: number;
  typ: "access";
};

/**
 * Payload do JWT temporário emitido após senha válida quando 2FA está ativo.
 * TTL curto; troca-se por sessão completa em `POST /auth/login/verify-2fa`.
 */
export type TwoFactorPendingPayload = {
  userId: string;
  tokenVersion: number;
  typ: "2fa_pending";
};

/** Par de tokens devolvido ao cliente após login ou refresh bem-sucedido. */
export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

/** Perfil do utilizador exposto na API (sem dados sensíveis). */
export type AuthUserResponse = {
  userId: string;
  tenantId: string | null;
  email: string;
  name?: string;
  tenant: TenantSummary | null;
  needsOnboarding: boolean;
  twoFactorEnabled: boolean;
  emailVerified: boolean;
  role?: UserRole;
};

/** Resposta completa de autenticação: perfil + tokens. */
export type AuthSessionResponse = AuthUserResponse & AuthTokens;

/** Resposta intermédia do login quando 2FA é obrigatório. */
export type TwoFactorPendingResponse = {
  requiresTwoFactor: true;
  twoFactorToken: string;
  expiresIn: string;
};

/** União de respostas possíveis do endpoint de login. */
export type LoginResponse = AuthSessionResponse | TwoFactorPendingResponse;
