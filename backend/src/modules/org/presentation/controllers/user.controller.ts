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
  UseFilters,
} from "@nestjs/common";
import type { z } from "zod";
import { AdminOnly, ProtectedApi } from "../../../../nest/api-access.decorators.js";
import { TenantId, UserId } from "../../../../nest/auth/request-params.js";
import { RouteErrorFilter } from "../../../../nest/http/api-exception.filter.js";
import { orNotFound } from "../../../../nest/http/not-found.js";
import { ZodValidationPipe } from "../../../../nest/http/zod-validation.pipe.js";
import { UserConflictError } from "../../domain/errors/user-conflict.error.js";
import { UserForbiddenError } from "../../domain/errors/user-forbidden.error.js";
import { ORG, type OrgContext } from "../../org.tokens.js";
import { userCreateBody, userIdParam, userUpdateBody } from "../schemas/user.schemas.js";

const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;
const USER_NOT_FOUND = "Usuário não encontrado";

const USER_ERROR_MAPPINGS = [
  { type: UserConflictError, status: 409 },
  { type: UserForbiddenError, status: 403 },
] as const;

type UserIdParam = z.infer<typeof userIdParam>;

/**
 * Controller HTTP de gestão de utilizadores do tenant.
 *
 * Listagem e leitura: qualquer membro autenticado.
 * Criação, edição e exclusão: ADMIN.
 * Todas as queries filtram por `tenantId` do JWT (isolamento multi-tenant).
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | GET | `/users` | ListUsersByTenantUseCase |
 * | GET | `/users/:id` | GetUserByIdUseCase |
 * | POST | `/users` | CreateUserUseCase (ADMIN) |
 * | PATCH | `/users/:id` | UpdateUserUseCase (ADMIN) |
 * | DELETE | `/users/:id` | DeleteUserUseCase (ADMIN) |
 */
@Controller("users")
@ProtectedApi()
@UseFilters(new RouteErrorFilter({ mappings: USER_ERROR_MAPPINGS }))
export class UserController {
  constructor(@Inject(ORG) private readonly org: OrgContext) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.org.listUsersByTenant.execute(tenantId);
  }

  @Get(":id")
  async get(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(userIdParam)) params: UserIdParam,
  ) {
    return orNotFound(await this.org.getUserById.execute(params.id, tenantId), USER_NOT_FOUND);
  }

  @Post()
  @AdminOnly()
  @HttpCode(HTTP_CREATED)
  create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(userCreateBody)) body: z.infer<typeof userCreateBody>,
  ) {
    return this.org.createUser.execute(tenantId, body);
  }

  @Patch(":id")
  @AdminOnly()
  async update(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(userIdParam)) params: UserIdParam,
    @Body(new ZodValidationPipe(userUpdateBody)) body: z.infer<typeof userUpdateBody>,
  ) {
    return orNotFound(await this.org.updateUser.execute(params.id, tenantId, body), USER_NOT_FOUND);
  }

  @Delete(":id")
  @AdminOnly()
  @HttpCode(HTTP_NO_CONTENT)
  async remove(
    @TenantId() tenantId: string,
    @UserId() currentUserId: string,
    @Param(new ZodValidationPipe(userIdParam)) params: UserIdParam,
  ) {
    orNotFound(
      await this.org.deleteUser.execute(params.id, tenantId, currentUserId),
      USER_NOT_FOUND,
    );
  }
}
