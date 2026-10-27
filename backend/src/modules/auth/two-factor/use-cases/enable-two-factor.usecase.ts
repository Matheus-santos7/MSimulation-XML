import { Inject, Injectable } from "@nestjs/common";
import { AuthError } from "../../errors/auth.errors.js";
import { TotpProvider } from "../../providers/totp.provider.js";
import { UserRepository } from "../../user/user.repository.js";

/**
 * Ativa o 2FA depois que o usuário confirma um código do autenticador.
 *
 * @throws {AuthError.State} Configuração não iniciada ou 2FA já ativo
 * @throws {AuthError.TwoFactorRequired} Código inválido
 */
@Injectable()
export class EnableTwoFactorUseCase {
  constructor(
    @Inject(UserRepository) private readonly userRepository: UserRepository,
    @Inject(TotpProvider) private readonly totp: TotpProvider,
  ) {}

  async execute(userId: string, code: string) {
    const user = await this.userRepository.findAuthUserById(userId);
    if (!user) throw new AuthError.State("Usuário não encontrado");
    if (user.totpEnabledAt) {
      throw new AuthError.State("Autenticação em duas etapas já está ativa");
    }

    const secret = user.totpSecretEnc ? this.totp.decryptSecret(user.totpSecretEnc) : null;
    if (!secret) {
      throw new AuthError.State("Inicie a configuração antes de ativar");
    }
    if (!(await this.totp.verifyCode(secret, code))) {
      throw new AuthError.TwoFactorRequired();
    }

    await this.userRepository.enableTotp(userId);

    return { enabled: true };
  }
}
