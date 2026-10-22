import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CaptchaTokenField, EmailField } from "../../rules/credential.validators.js";

export class ForgotPasswordRequestDTO {
  @ApiProperty({ type: String })
  @EmailField()
  email!: string;

  @ApiPropertyOptional({ type: String, description: "Token do Cloudflare Turnstile" })
  @CaptchaTokenField()
  captchaToken?: string;
}
