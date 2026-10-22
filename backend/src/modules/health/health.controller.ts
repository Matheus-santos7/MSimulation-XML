import { Controller, Get, Inject, Res } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { HealthResponseDTO } from "./dtos/health.response.dto.js";
import { HealthService } from "./health.service.js";

const HTTP_SERVICE_UNAVAILABLE = 503;

/** Health check público (ALB e healthcheck do container). Sem guard, rate limit ou transação. */
@Controller("health")
@ApiTags("health")
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  @ApiResponse({ status: 200, type: HealthResponseDTO })
  @ApiResponse({ status: HTTP_SERVICE_UNAVAILABLE, type: HealthResponseDTO })
  async check(@Res({ passthrough: true }) reply: FastifyReply): Promise<HealthResponseDTO> {
    const health = await this.healthService.check();
    if (health.database === "unavailable") reply.status(HTTP_SERVICE_UNAVAILABLE);

    return health;
  }
}
