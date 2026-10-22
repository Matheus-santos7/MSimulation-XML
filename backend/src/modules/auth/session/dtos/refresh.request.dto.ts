import { ApiProperty } from "@nestjs/swagger";
import { Required } from "../../../../nest/http/class-validator.pipe.js";
import { IsText, TextMinLength } from "../../../../nest/http/text.validators.js";

export const REFRESH_TOKEN_MIN_LENGTH = 20;

export class RefreshRequestDTO {
  @ApiProperty({ type: String })
  @Required()
  @IsText()
  @TextMinLength(REFRESH_TOKEN_MIN_LENGTH, "Refresh token inválido")
  refreshToken!: string;
}
