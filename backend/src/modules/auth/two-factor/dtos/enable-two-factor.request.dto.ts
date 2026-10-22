import { ApiProperty } from "@nestjs/swagger";
import { Required } from "../../../../nest/http/class-validator.pipe.js";
import { TotpCodeRules } from "../../rules/credential.validators.js";

export class EnableTwoFactorRequestDTO {
  @ApiProperty({ type: String, example: "123456" })
  @Required()
  @TotpCodeRules()
  code!: string;
}
