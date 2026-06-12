import { AuthStateError } from "../../domain/errors/auth-state.error.js";
import { AuthUnauthorizedError } from "../../domain/errors/auth-unauthorized.error.js";
import { TwoFactorRequiredError } from "../../domain/errors/two-factor-required.error.js";
import type { PasswordHasherPort } from "../../domain/ports/password-hasher.port.js";
import type { TotpPort } from "../../domain/ports/totp.port.js";
import type { UserRepository } from "../../domain/ports/user.repository.js";

export class DisableTwoFactorUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly totp: TotpPort,
  ) {}

  async execute(userId: string, password: string, code: string) {
    const user = await this.userRepository.findAuthUserById(userId);
    if (!user) throw new AuthStateError("Usuário não encontrado");
    if (!user.totpEnabledAt) {
      throw new AuthStateError("Autenticação em duas etapas não está ativa");
    }

    const isValidPassword = await this.passwordHasher.verify(password, user.password);
    if (!isValidPassword) {
      throw new AuthUnauthorizedError("Senha incorreta");
    }

    const secret = user.totpSecretEnc ? this.totp.decryptSecret(user.totpSecretEnc) : null;
    if (!secret || !(await this.totp.verifyCode(secret, code))) {
      throw new TwoFactorRequiredError();
    }

    await this.userRepository.disableTotp(userId);

    return { enabled: false };
  }
}
