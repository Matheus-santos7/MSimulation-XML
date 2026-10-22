import { ApiProperty } from "@nestjs/swagger";

export type HealthStatus = "ok" | "degraded";
export type DatabaseStatus = "ok" | "unavailable";

export class HealthResponseDTO {
  @ApiProperty({ type: String, enum: ["ok", "degraded"] })
  status!: HealthStatus;

  @ApiProperty({ type: String, enum: ["api"] })
  service!: "api";

  @ApiProperty({ type: String, enum: ["ok", "unavailable"] })
  database!: DatabaseStatus;

  @ApiProperty({ type: String, format: "date-time" })
  timestamp!: string;
}
