import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  CaptchaTokenField,
  CurrentPasswordField,
  EmailField,
} from "../../rules/credential.validators.js";

export class LoginRequestDTO {
  @ApiProperty({ type: String, example: "usuario@empresa.com.br" })
  @EmailField()
  email!: string;

  @ApiProperty({ type: String })
  @CurrentPasswordField()
  password!: string;

  @ApiPropertyOptional({ type: String, description: "Token do Cloudflare Turnstile" })
  @CaptchaTokenField()
  captchaToken?: string;
}
