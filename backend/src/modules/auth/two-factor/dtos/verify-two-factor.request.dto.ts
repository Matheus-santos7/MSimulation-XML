import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Required } from "../../../../nest/http/class-validator.pipe.js";
import { IsText, TextMinLength } from "../../../../nest/http/text.validators.js";
import { CaptchaTokenField, TotpCodeRules } from "../../rules/credential.validators.js";

const TWO_FACTOR_TOKEN_MIN_LENGTH = 20;

export class VerifyTwoFactorRequestDTO {
  @ApiProperty({ type: String, description: "Token `2fa_pending` devolvido pelo login" })
  @Required()
  @IsText()
  @TextMinLength(TWO_FACTOR_TOKEN_MIN_LENGTH, "Sessão de verificação inválida")
  twoFactorToken!: string;

  @ApiProperty({ type: String, example: "123456" })
  @Required()
  @TotpCodeRules()
  code!: string;

  @ApiPropertyOptional({ type: String, description: "Token do Cloudflare Turnstile" })
  @CaptchaTokenField()
  captchaToken?: string;
}
