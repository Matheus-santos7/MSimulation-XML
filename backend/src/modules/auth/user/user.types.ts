/** Papel do utilizador dentro do tenant (após onboarding). */
export type UserRole = "ADMIN" | "MEMBER";

/**
 * Utilizador autenticável persistido em `user`.
 *
 * Regras de negócio relevantes:
 * - `tenantId === null` indica conta sem empresa (precisa onboarding).
 * - `tokenVersion` incrementa no logout global e invalida access tokens antigos.
 * - `totpEnabledAt` / `totpSecretEnc` controlam 2FA TOTP.
 * - `failedLoginAttempts` + `lockedUntil` implementam lockout progressivo.
 */
export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  password: string;
  tenantId: string | null;
  role: UserRole;
  tokenVersion: number;
  emailVerifiedAt: Date | null;
  totpEnabledAt: Date | null;
  totpSecretEnc: string | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
};

/** Resumo do tenant (empresa emitente) para respostas de sessão e `/auth/me`. */
export type TenantSummary = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  ie: string;
  iest?: string;
  crt: number;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
  codigoPais: number;
  nomePais: string;
  telefone?: string;
  ambiente: string;
};

/** Utilizador com tenant opcional (join Prisma `user` + `tenant`). */
export type AuthUserWithTenant = AuthUser & {
  tenant: TenantSummary | null;
};
