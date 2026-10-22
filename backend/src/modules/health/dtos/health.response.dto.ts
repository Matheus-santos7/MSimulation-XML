import { ApiProperty } from "@nestjs/swagger";

export type HealthStatus = "ok" | "degraded";
export type DatabaseStatus = "ok" | "unavailable";

export class HealthResponseDTO {
  @ApiProperty({ enum: ["ok", "degraded"] })
  status!: HealthStatus;

  @ApiProperty({ enum: ["api"] })
  service!: "api";

  @ApiProperty({ enum: ["ok", "unavailable"] })
  database!: DatabaseStatus;

  @ApiProperty({ format: "date-time" })
  timestamp!: string;
}
