import { AuthStateError } from "../../domain/errors/auth-state.error.js";
import type { TotpPort } from "../../domain/ports/totp.port.js";
import type { UserRepository } from "../../domain/ports/user.repository.js";

/**
 * Inicia configuração 2FA: gera segredo TOTP e URL otpauth para QR code.
 *
 * O segredo fica encriptado em `totpSecretEnc` até {@link EnableTwoFactorUseCase}.
 *
 * @param userId - Utilizador autenticado
 * @returns Segredo, URL otpauth e issuer
 * @throws {AuthStateError} 2FA já ativo ou utilizador inexistente
 */
export class SetupTwoFactorUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly totp: TotpPort,
  ) {}

  async execute(userId: string) {
    const user = await this.userRepository.findAuthUserById(userId);
    if (!user) throw new AuthStateError("Usuário não encontrado");
    if (user.totpEnabledAt) {
      throw new AuthStateError("Autenticação em duas etapas já está ativa");
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
