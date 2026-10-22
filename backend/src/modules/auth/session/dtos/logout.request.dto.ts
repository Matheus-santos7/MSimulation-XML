import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsText, TextMinLength } from "../../../../nest/http/text.validators.js";
import { REFRESH_TOKEN_MIN_LENGTH } from "./refresh.request.dto.js";

/** Corpo opcional do logout: refresh token inválido é ignorado (o logout sempre responde 204). */
export class LogoutRequestDTO {
  @ApiPropertyOptional({ type: String })
  @IsText()
  @TextMinLength(REFRESH_TOKEN_MIN_LENGTH, "Refresh token inválido")
  refreshToken?: string;
}
