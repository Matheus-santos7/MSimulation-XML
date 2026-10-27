import { Inject, Injectable } from "@nestjs/common";
import { AuthError } from "../../errors/auth.errors.js";
import { TotpProvider } from "../../providers/totp.provider.js";
import { UserRepository } from "../../user/user.repository.js";

/**
 * Inicia a configuração do 2FA: gera o segredo TOTP e a URL otpauth do QR code.
 * O segredo fica cifrado em `totpSecretEnc` até `EnableTwoFactorUseCase`.
 *
 * @throws {AuthError.State} 2FA já ativo ou usuário inexistente
 */
@Injectable()
export class SetupTwoFactorUseCase {
  constructor(
    @Inject(UserRepository) private readonly userRepository: UserRepository,
    @Inject(TotpProvider) private readonly totp: TotpProvider,
  ) {}

  async execute(userId: string) {
    const user = await this.userRepository.findAuthUserById(userId);
    if (!user) throw new AuthError.State("Usuário não encontrado");
    if (user.totpEnabledAt) {
      throw new AuthError.State("Autenticação em duas etapas já está ativa");
    }

    const secret = this.totp.generateSecret();
    await this.userRepository.saveTotpSecret(userId, this.totp.encryptSecret(secret));

    return {
      secret,
      otpauthUrl: this.totp.buildOtpAuthUrl(user.email, secret),
      issuer: this.totp.issuer,
    };
  }
}
