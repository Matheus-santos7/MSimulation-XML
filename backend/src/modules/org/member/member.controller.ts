import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminOnly, ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId, UserId } from "../../../nest/auth/request-params.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import {
  createMemberRequestSchema,
  type CreateMemberRequestDTO,
} from "./dtos/create-member.request.dto.js";
import { memberParamsSchema, type MemberParamsDTO } from "./dtos/member.params.dto.js";
import {
  updateMemberRequestSchema,
  type UpdateMemberRequestDTO,
} from "./dtos/update-member.request.dto.js";
import { MemberService } from "./member.service.js";

const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;

/**
 * Usuários da empresa.
 *
 * | Método | Rota | Service |
 * |--------|------|---------|
 * | GET | `/users` | list |
 * | GET | `/users/:id` | get |
 * | POST | `/users` | create (ADMIN) |
 * | PATCH | `/users/:id` | update (ADMIN) |
 * | DELETE | `/users/:id` | delete (ADMIN) |
 */
@Controller("users")
@ApiTags("users")
@ProtectedApi()
export class MemberController {
  constructor(@Inject(MemberService) private readonly memberService: MemberService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.memberService.list(tenantId);
  }

  @Get(":id")
  get(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(memberParamsSchema)) params: MemberParamsDTO,
  ) {
    return this.memberService.get(params.id, tenantId);
  }

  @Post()
  @AdminOnly()
  @HttpCode(HTTP_CREATED)
  create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(createMemberRequestSchema)) body: CreateMemberRequestDTO,
  ) {
    return this.memberService.create(tenantId, body);
  }

  @Patch(":id")
  @AdminOnly()
  update(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(memberParamsSchema)) params: MemberParamsDTO,
    @Body(new ZodValidationPipe(updateMemberRequestSchema)) body: UpdateMemberRequestDTO,
  ) {
    return this.memberService.update(params.id, tenantId, body);
  }

  @Delete(":id")
  @AdminOnly()
  @HttpCode(HTTP_NO_CONTENT)
  remove(
    @TenantId() tenantId: string,
    @UserId() currentUserId: string,
    @Param(new ZodValidationPipe(memberParamsSchema)) params: MemberParamsDTO,
  ) {
    return this.memberService.delete(params.id, tenantId, currentUserId);
  }
}
