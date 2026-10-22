import { Inject, Injectable } from "@nestjs/common";
import { AuthSettings } from "../../auth.settings.js";
import { AuthError } from "../../errors/auth.errors.js";
import type { AuthMeta, AuthSessionResponse } from "../../session/session.types.js";
import { FinishLoginUseCase } from "../../session/use-cases/finish-login.usecase.js";
import { OnboardingRepository, type TenantOnboardingData } from "../onboarding.repository.js";

/**
 * Onboarding: cria a empresa (tenant) e vincula ao usuário como ADMIN. Exige e-mail confirmado
 * quando a verificação está ligada. Devolve sessão nova, já com `tenantId`.
 *
 * @throws {AuthError.State} Empresa já vinculada, e-mail não confirmado ou usuário inexistente
 * @throws {TenantConflictError} CNPJ duplicado (do repository)
 */
@Injectable()
export class AttachTenantOnboardingUseCase {
  constructor(
    @Inject(OnboardingRepository) private readonly onboardingRepository: OnboardingRepository,
    @Inject(FinishLoginUseCase) private readonly finishLogin: FinishLoginUseCase,
    @Inject(AuthSettings) private readonly settings: AuthSettings,
  ) {}

  async execute(
    command: { userId: string; tenantData: TenantOnboardingData },
    meta: AuthMeta = {},
  ): Promise<AuthSessionResponse> {
    const user = await this.onboardingRepository.findUserForOnboarding(command.userId);
    if (!user) throw new AuthError.State("Usuário não encontrado");
    if (user.tenantId) throw new AuthError.State("Empresa já vinculada à conta");
    if (this.settings.requireEmailVerification && !user.emailVerifiedAt) {
      throw new AuthError.State("Confirme seu e-mail antes de cadastrar a empresa");
    }

    await this.onboardingRepository.createTenantAndAttachUser(command.userId, command.tenantData);

    return this.finishLogin.execute(command.userId, meta);
  }
}
