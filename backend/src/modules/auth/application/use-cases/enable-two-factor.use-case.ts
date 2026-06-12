import { AuthStateError } from "../../domain/errors/auth-state.error.js";
import { TwoFactorRequiredError } from "../../domain/errors/two-factor-required.error.js";
import type { TotpPort } from "../../domain/ports/totp.port.js";
import type { UserRepository } from "../../domain/ports/user.repository.js";

export class EnableTwoFactorUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly totp: TotpPort,
  ) {}

  async execute(userId: string, code: string) {
    const user = await this.userRepository.findAuthUserById(userId);
    if (!user) throw new AuthStateError("Usuário não encontrado");
    if (user.totpEnabledAt) {
      throw new AuthStateError("Autenticação em duas etapas já está ativa");
    }

    const secret = user.totpSecretEnc ? this.totp.decryptSecret(user.totpSecretEnc) : null;
    if (!secret) {
      throw new AuthStateError("Inicie a configuração antes de ativar");
    }
    if (!(await this.totp.verifyCode(secret, code))) {
      throw new TwoFactorRequiredError();
    }

    await this.userRepository.enableTotp(userId);

    return { enabled: true };
  }
}
