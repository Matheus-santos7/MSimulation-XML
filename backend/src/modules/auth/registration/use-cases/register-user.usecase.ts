import { Inject, Injectable } from "@nestjs/common";
import { isPrismaUniqueError } from "../../../../lib/db/prisma-errors.js";
import { AuthSettings } from "../../auth.settings.js";
import { SendVerificationEmailUseCase } from "../../email-verification/use-cases/send-verification-email.usecase.js";
import { AuthError } from "../../errors/auth.errors.js";
import { EmailSenderProvider } from "../../providers/email-sender.provider.js";
import { PasswordHasherProvider } from "../../providers/password-hasher.provider.js";
import type { AuthMeta, AuthSessionResponse } from "../../session/session.types.js";
import { FinishLoginUseCase } from "../../session/use-cases/finish-login.usecase.js";
import { UserRepository } from "../../user/user.repository.js";
import type { RegisterRequestDTO } from "../dtos/register.request.dto.js";

/**
 * Cadastra conta nova: confere e-mail único, cria o usuário e já inicia a sessão.
 *
 * Com verificação obrigatória, envia o e-mail de confirmação (falha no envio não bloqueia o
 * cadastro). E-mail já existente recebe resposta genérica (anti-enumeração), com o mesmo tempo
 * de resposta e um aviso ao titular da conta.
 *
 * @throws {AuthError.State} Cadastro não concluído (mensagem genérica)
 */
@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(UserRepository) private readonly userRepository: UserRepository,
    @Inject(FinishLoginUseCase) private readonly finishLogin: FinishLoginUseCase,
    @Inject(SendVerificationEmailUseCase)
    private readonly sendVerificationEmail: SendVerificationEmailUseCase,
    @Inject(PasswordHasherProvider) private readonly passwordHasher: PasswordHasherProvider,
    @Inject(EmailSenderProvider) private readonly emailSender: EmailSenderProvider,
    @Inject(AuthSettings) private readonly settings: AuthSettings,
  ) {}

  async execute(
    command: Pick<RegisterRequestDTO, "email" | "password" | "name">,
    meta: AuthMeta = {},
  ): Promise<AuthSessionResponse> {
    const existingUser = await this.userRepository.findByEmail(command.email);
    if (existingUser) {
      await this.rejectDuplicateRegistration(
        command.password,
        existingUser.email,
        existingUser.name,
      );
    }

    const requireEmailVerification = this.settings.requireEmailVerification;
    let user;
    try {
      user = await this.userRepository.createUser({
        email: command.email,
        name: command.name,
        passwordHash: await this.passwordHasher.hash(command.password),
        emailVerifiedAt: requireEmailVerification ? null : new Date(),
      });
    } catch (error) {
      if (isPrismaUniqueError(error)) {
        await this.rejectDuplicateRegistration(command.password, command.email, command.name);
      }
      throw error;
    }

    if (requireEmailVerification) {
      try {
        await this.sendVerificationEmail.execute(user.id);
      } catch {
        // Falha no envio do e-mail de confirmação não bloqueia o cadastro.
      }
    }

    return this.finishLogin.execute(user.id, meta);
  }

  private async rejectDuplicateRegistration(
    password: string,
    email: string,
    recipientName?: string | null,
  ): Promise<never> {
    await this.passwordHasher.hash(password);
    await this.passwordHasher.authFailureDelay();

    const appUrl = this.settings.appPublicUrl;
    try {
      await this.emailSender.sendRegistrationAttemptAlert({
        to: email,
        loginUrl: `${appUrl}/login`,
        forgotPasswordUrl: `${appUrl}/login/esqueci-senha`,
        recipientName,
        idempotencyKey: `registration-attempt/${email}`,
      });
    } catch {
      // Falha no aviso por e-mail não muda a resposta do cadastro duplicado.
    }

    throw new AuthError.State(this.settings.registerGenericFailureMessage);
  }
}
