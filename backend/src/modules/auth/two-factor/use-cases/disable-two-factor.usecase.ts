import { Inject, Injectable } from "@nestjs/common";
import { AuthError } from "../../errors/auth.errors.js";
import { PasswordHasherProvider } from "../../providers/password-hasher.provider.js";
import { TotpProvider } from "../../providers/totp.provider.js";
import { UserRepository } from "../../user/user.repository.js";

/**
 * Desativa o 2FA, exigindo a senha atual e um código TOTP válido.
 *
 * @throws {AuthError.Unauthorized} Senha incorreta
 * @throws {AuthError.TwoFactorRequired} Código TOTP inválido
 * @throws {AuthError.State} 2FA não está ativo
 */
@Injectable()
export class DisableTwoFactorUseCase {
  constructor(
    @Inject(UserRepository) private readonly userRepository: UserRepository,
    @Inject(PasswordHasherProvider) private readonly passwordHasher: PasswordHasherProvider,
    @Inject(TotpProvider) private readonly totp: TotpProvider,
  ) {}

  async execute(userId: string, password: string, code: string) {
    const user = await this.userRepository.findAuthUserById(userId);
    if (!user) throw new AuthError.State("Usuário não encontrado");
    if (!user.totpEnabledAt) {
      throw new AuthError.State("Autenticação em duas etapas não está ativa");
    }

    const isValidPassword = await this.passwordHasher.verify(password, user.password);
    if (!isValidPassword) {
      throw new AuthError.Unauthorized("Senha incorreta");
    }

    const secret = user.totpSecretEnc ? this.totp.decryptSecret(user.totpSecretEnc) : null;
    if (!secret || !(await this.totp.verifyCode(secret, code))) {
      throw new AuthError.TwoFactorRequired();
    }

    await this.userRepository.disableTotp(userId);

    return { enabled: false };
  }
}
