import type { AuthSessionResponse } from "../../domain/entities/auth-session.entity.js";
import { AuthConflictError } from "../../domain/errors/auth-conflict.error.js";
import type { PasswordHasherPort } from "../../domain/ports/password-hasher.port.js";
import type {
  AuthMeta,
  SessionResponsePort,
  SignAccessToken,
} from "../../domain/ports/session-response.port.js";
import type { UserRepository } from "../../domain/ports/user.repository.js";
import type { RegisterUserCommand } from "../dto/register-user.command.js";
import { FinishLoginUseCase } from "./finish-login.use-case.js";
import { SendVerificationEmailUseCase } from "./send-verification-email.use-case.js";

export type RegisterUserDeps = {
  requireEmailVerification: boolean;
};

export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly finishLogin: FinishLoginUseCase,
    private readonly sendVerificationEmail: SendVerificationEmailUseCase,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly deps: RegisterUserDeps,
  ) {}

  async execute(
    command: RegisterUserCommand,
    signAccess: SignAccessToken,
    meta: AuthMeta = {},
  ): Promise<AuthSessionResponse> {
    const emailExists = await this.userRepository.existsByEmail(command.email);
    if (emailExists) {
      throw new AuthConflictError("E-mail já cadastrado");
    }

    const user = await this.userRepository.createUser({
      email: command.email,
      name: command.name,
      passwordHash: await this.passwordHasher.hash(command.password),
      emailVerifiedAt: this.deps.requireEmailVerification ? null : new Date(),
    });

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
}
