import { ApiProperty } from "@nestjs/swagger";
import { Required } from "../../../../nest/http/class-validator.pipe.js";
import { CurrentPasswordField, TotpCodeRules } from "../../rules/credential.validators.js";

export class DisableTwoFactorRequestDTO {
  @ApiProperty({ type: String })
  @CurrentPasswordField()
  password!: string;

  @ApiProperty({ type: String, example: "123456" })
  @Required()
  @TotpCodeRules()
  code!: string;
}
