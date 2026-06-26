import type { AuthSessionResponse } from "../../domain/entities/auth-session.entity.js";
import { AuthStateError } from "../../domain/errors/auth-state.error.js";
import { EmailDeliveryError } from "../../domain/errors/email-delivery.error.js";
import type { EmailSenderPort } from "../../domain/ports/email-sender.port.js";
import type { PasswordHasherPort } from "../../domain/ports/password-hasher.port.js";
import type {
  AuthMeta,
  SessionResponsePort,
  SignAccessToken,
} from "../../domain/ports/session-response.port.js";
import type { UserRepository } from "../../domain/ports/user.repository.js";
import { isPrismaUniqueError } from "../../infrastructure/prisma/prisma-errors.js";
import type { RegisterUserCommand } from "../dto/register-user.command.js";
import { FinishLoginUseCase } from "./finish-login.use-case.js";
import { SendVerificationEmailUseCase } from "./send-verification-email.use-case.js";

export type RegisterUserDeps = {
  requireEmailVerification: boolean;
  genericFailureMessage: string;
  appPublicUrl: string;
};

/**
 * Regista nova conta: valida unicidade de e-mail, cria utilizador e inicia sessão.
 *
 * Em produção com verificação obrigatória, envia e-mail de confirmação (falha de
 * envio não bloqueia o registo em desenvolvimento).
 *
 * Respostas para e-mail já existente são genéricas (anti-enumeração), com atraso
 * artificial e notificação ao titular da conta.
 *
 * @param command - E-mail, senha, nome e captcha (validado no controller)
 * @returns Sessão autenticada imediata
 * @throws {AuthStateError} Cadastro não concluído (mensagem genérica)
 */
export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly finishLogin: FinishLoginUseCase,
    private readonly sendVerificationEmail: SendVerificationEmailUseCase,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly emailSender: EmailSenderPort,
    private readonly deps: RegisterUserDeps,
  ) {}

  async execute(
    command: RegisterUserCommand,
    signAccess: SignAccessToken,
    meta: AuthMeta = {},
  ): Promise<AuthSessionResponse> {
    const existingUser = await this.userRepository.findByEmail(command.email);
    if (existingUser) {
      await this.rejectDuplicateRegistration(command.password, existingUser.email, existingUser.name);
    }

    let user;
    try {
      user = await this.userRepository.createUser({
        email: command.email,
        name: command.name,
        passwordHash: await this.passwordHasher.hash(command.password),
        emailVerifiedAt: this.deps.requireEmailVerification ? null : new Date(),
      });
    } catch (error) {
      if (isPrismaUniqueError(error)) {
        await this.rejectDuplicateRegistration(command.password, command.email, command.name);
      }
      throw error;
    }

    if (this.deps.requireEmailVerification) {
      try {
        await this.sendVerificationEmail.execute(user.id);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[dev] Falha ao enviar e-mail de verificação no registro:", error);
        }
      }
    }

    return this.finishLogin.execute(user.id, meta, signAccess);
  }

  private async rejectDuplicateRegistration(
    password: string,
    email: string,
    recipientName?: string | null,
  ): Promise<never> {
    await this.passwordHasher.hash(password);
    await this.passwordHasher.authFailureDelay();

    try {
      const loginUrl = `${this.deps.appPublicUrl}/login`;
      const forgotPasswordUrl = `${this.deps.appPublicUrl}/login/esqueci-senha`;
      await this.emailSender.sendRegistrationAttemptAlert({
        to: email,
        loginUrl,
        forgotPasswordUrl,
        recipientName,
        idempotencyKey: `registration-attempt/${email}`,
      });
    } catch (error) {
      if (error instanceof EmailDeliveryError && process.env.NODE_ENV !== "production") {
        console.warn("[dev] Falha ao enviar alerta de tentativa de cadastro:", error.message);
      } else if (error instanceof EmailDeliveryError) {
        console.error("Falha Resend (tentativa de cadastro):", error.message);
      }
    }

    throw new AuthStateError(this.deps.genericFailureMessage);
  }
}
