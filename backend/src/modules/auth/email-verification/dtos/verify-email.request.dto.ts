import { ApiProperty } from "@nestjs/swagger";
import { Required } from "../../../../nest/http/class-validator.pipe.js";
import { IsText, TextMinLength } from "../../../../nest/http/text.validators.js";
import { LINK_TOKEN_MIN_LENGTH } from "../../password-reset/dtos/reset-password.request.dto.js";

export class VerifyEmailRequestDTO {
  @ApiProperty({ type: String, description: "Token do link enviado por e-mail" })
  @Required()
  @IsText()
  @TextMinLength(LINK_TOKEN_MIN_LENGTH, "Link inválido ou expirado")
  token!: string;
}
