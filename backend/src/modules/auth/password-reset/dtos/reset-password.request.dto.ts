import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Required } from "../../../../nest/http/class-validator.pipe.js";
import { IsText, TextMinLength } from "../../../../nest/http/text.validators.js";
import { StrongPasswordField, TotpCodeRules } from "../../rules/credential.validators.js";

export const LINK_TOKEN_MIN_LENGTH = 32;

export class ResetPasswordRequestDTO {
  @ApiProperty({ type: String, description: "Token do link enviado por e-mail" })
  @Required()
  @IsText()
  @TextMinLength(LINK_TOKEN_MIN_LENGTH, "Link inválido ou expirado")
  token!: string;

  @ApiProperty({ type: String })
  @StrongPasswordField()
  password!: string;

  @ApiPropertyOptional({ type: String, description: "Código TOTP, exigido com 2FA ativo" })
  @TotpCodeRules()
  code?: string;
}
