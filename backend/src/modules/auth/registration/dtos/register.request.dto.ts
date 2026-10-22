import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsText, TextMaxLength } from "../../../../nest/http/text.validators.js";
import {
  CaptchaTokenField,
  PermanentEmailField,
  StrongPasswordField,
} from "../../rules/credential.validators.js";

const NAME_MAX_LENGTH = 120;

export class RegisterRequestDTO {
  @ApiProperty({ type: String, example: "usuario@empresa.com.br" })
  @PermanentEmailField()
  email!: string;

  @ApiProperty({ type: String, minLength: 8 })
  @StrongPasswordField()
  password!: string;

  @ApiPropertyOptional({ type: String })
  // `.trim()` + texto vazio vira ausente.
  @Transform(({ value }) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @IsText()
  @TextMaxLength(NAME_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional({ type: String, description: "Token do Cloudflare Turnstile" })
  @CaptchaTokenField()
  captchaToken?: string;
}
