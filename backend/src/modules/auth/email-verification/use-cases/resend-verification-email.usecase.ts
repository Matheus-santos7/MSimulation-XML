import { Inject, Injectable } from "@nestjs/common";
import { AuthSettings } from "../../auth.settings.js";
import { AuthError } from "../../errors/auth.errors.js";
import { SendVerificationEmailUseCase } from "./send-verification-email.usecase.js";

/** Reenvia o e-mail de confirmação; a resposta não revela se o e-mail já estava confirmado. */
@Injectable()
export class ResendVerificationEmailUseCase {
  constructor(
    @Inject(SendVerificationEmailUseCase)
    private readonly sendVerificationEmail: SendVerificationEmailUseCase,
    @Inject(AuthSettings) private readonly settings: AuthSettings,
  ) {}

  async execute(userId: string): Promise<{ message: string }> {
    if (!this.settings.requireEmailVerification) {
      return { message: "Verificação de e-mail não é necessária neste ambiente." };
    }

    try {
      await this.sendVerificationEmail.execute(userId);
    } catch (error) {
      // Falha de envio fica invisível para o usuário (mesma resposta genérica).
      if (!(error instanceof AuthError.EmailDelivery)) throw error;
    }

    return { message: this.settings.emailVerificationGenericMessage };
  }
}
