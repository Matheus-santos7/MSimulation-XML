import type { AuthSessionResponse } from "../../domain/entities/auth-session.entity.js";
import { AuthStateError } from "../../domain/errors/auth-state.error.js";
import type { OnboardingRepository } from "../../domain/ports/onboarding.repository.js";
import type {
  AuthMeta,
  SignAccessToken,
} from "../../domain/ports/session-response.port.js";
import type { AttachTenantOnboardingCommand } from "../dto/attach-tenant-onboarding.command.js";
import { FinishLoginUseCase } from "./finish-login.use-case.js";

export type AttachTenantOnboardingDeps = {
  requireEmailVerification: boolean;
};

/**
 * Onboarding: cria tenant (empresa) e vincula ao utilizador como ADMIN.
 *
 * Exige e-mail verificado quando configurado. Devolve nova sessão com `tenantId`.
 *
 * @param command - `userId` e dados fiscais da empresa
 * @returns Sessão atualizada via {@link FinishLoginUseCase}
 * @throws {AuthStateError} Empresa já vinculada, e-mail não verificado ou user inexistente
 * @throws {TenantConflictError} CNPJ duplicado (propagado do repository)
 */
export class AttachTenantOnboardingUseCase {
  constructor(
    private readonly onboardingRepository: OnboardingRepository,
    private readonly finishLogin: FinishLoginUseCase,
    private readonly deps: AttachTenantOnboardingDeps,
  ) {}

  async execute(
    command: AttachTenantOnboardingCommand,
    signAccess: SignAccessToken,
    meta: AuthMeta = {},
  ): Promise<AuthSessionResponse> {
    const user = await this.onboardingRepository.findUserForOnboarding(command.userId);
    if (!user) throw new AuthStateError("Usuário não encontrado");
    if (user.tenantId) throw new AuthStateError("Empresa já vinculada à conta");
    if (this.deps.requireEmailVerification && !user.emailVerifiedAt) {
      throw new AuthStateError("Confirme seu e-mail antes de cadastrar a empresa");
    }

    await this.onboardingRepository.createTenantAndAttachUser(command.userId, command.tenantData);

    return this.finishLogin.execute(command.userId, meta, signAccess);
  }
}
