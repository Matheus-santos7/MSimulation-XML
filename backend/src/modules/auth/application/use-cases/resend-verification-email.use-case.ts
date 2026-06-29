import { EmailDeliveryError } from "../../domain/errors/email-delivery.error.js";
import { SendVerificationEmailUseCase } from "./send-verification-email.use-case.js";

export type ResendVerificationEmailDeps = {
  requireEmailVerification: boolean;
  genericMessage: string;
};

/**
 * Reenvia e-mail de verificação para utilizador autenticado.
 *
 * @param userId - ID do JWT de acesso
 * @returns Mensagem genérica (não revela se e-mail já estava verificado)
 */
export class ResendVerificationEmailUseCase {
  constructor(
    private readonly sendVerificationEmail: SendVerificationEmailUseCase,
    private readonly deps: ResendVerificationEmailDeps,
  ) {}

  async execute(userId: string): Promise<{ message: string }> {
    if (!this.deps.requireEmailVerification) {
      return { message: "Verificação de e-mail não é necessária neste ambiente." };
    }

    try {
      await this.sendVerificationEmail.execute(userId);
    } catch (error) {
      if (error instanceof EmailDeliveryError && process.env.NODE_ENV !== "production") {
        console.warn("[dev] Falha ao enviar e-mail de verificação:", error.message);
      } else if (error instanceof EmailDeliveryError) {
        console.error("Falha Brevo (verificação):", error.message);
      } else {
        throw error;
      }
    }

    return { message: this.deps.genericMessage };
  }
}
