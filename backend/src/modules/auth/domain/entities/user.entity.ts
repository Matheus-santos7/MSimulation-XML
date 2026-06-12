export type UserRole = "ADMIN" | "MEMBER";

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

export type AuthUserWithTenant = AuthUser & {
  tenant: TenantSummary | null;
};
