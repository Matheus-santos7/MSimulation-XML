import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { requireEmailVerification } from "../../../lib/auth/config.js";
import type { buildAccessPayload } from "../../../lib/auth/session.js";
import type { AuthSessionResponse } from "../../../lib/auth/types/index.js";
import { isPrismaUniqueError } from "../../../lib/org/db-errors.js";
import type { TenantCreateInput } from "../../../schemas/org/tenant.js";
import { TenantConflictError } from "../../org/tenant-service.js";
import { AuthService, AuthStateError, type AuthMeta } from "../auth-service.js";

export class OnboardingService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly auth: AuthService,
  ) {}

  async attachTenant(
    userId: string,
    data: TenantCreateInput,
    signAccess: (payload: ReturnType<typeof buildAccessPayload>) => string,
    meta: AuthMeta = {},
  ): Promise<AuthSessionResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AuthStateError("Usuário não encontrado");
    if (user.tenantId) throw new AuthStateError("Empresa já vinculada à conta");
    if (requireEmailVerification() && !user.emailVerifiedAt) {
      throw new AuthStateError("Confirme seu e-mail antes de cadastrar a empresa");
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const tenantRow = await tx.tenant.create({
          data: data as Prisma.TenantCreateInput,
        });
        await tx.user.update({
          where: { id: userId },
          data: { tenantId: tenantRow.id, role: "ADMIN" },
        });
      });
    } catch (e) {
      if (e instanceof TenantConflictError) throw e;
      if (isPrismaUniqueError(e)) {
        throw new TenantConflictError("CNPJ já cadastrado");
      }
      throw e;
    }

    return this.auth.finishLogin(userId, meta, signAccess);
  }
}
