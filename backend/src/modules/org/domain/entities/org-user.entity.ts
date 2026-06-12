/** Papel do utilizador dentro do tenant. ADMIN gere utilizadores; MEMBER é operacional. */
export type OrgUserRole = "ADMIN" | "MEMBER";

/**
 * Utilizador vinculado a um tenant (visão Org / gestão de equipa).
 *
 * Diferente de `AuthUser` no módulo auth: aqui expõe apenas dados seguros para
 * listagem e CRUD administrativo (sem password, lockout ou 2FA).
 *
 * Regras:
 * - `tenantId` obrigatório neste contexto (rotas org exigem tenant no JWT)
 * - E-mail único globalmente (`@@unique([email])` no Prisma)
 * - O fundador do onboarding recebe `ADMIN`; convidados criados via API são `MEMBER`
 */
export type OrgUser = {
  id: string;
  tenantId: string;
  email: string;
  name?: string;
  role: OrgUserRole;
  createdAt: string;
  updatedAt: string;
};
