import { Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  ACCESS_MESSAGES,
  authenticateRequest,
  isAdmin,
  isEmailVerificationPending,
  isTenantMissing,
} from "../../lib/auth/access-control.js";
import { HttpError } from "../../lib/http/http-error.js";
import { PRISMA } from "../tokens.js";

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

function requestOf(context: ExecutionContext): FastifyRequest {
  return context.switchToHttp().getRequest<FastifyRequest>();
}

/** JWT de acesso válido + `tokenVersion` atual no banco (equivalente a `app.authenticate`). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = requestOf(context);
    const result = await authenticateRequest(this.prisma, request);
    if ("error" in result) {
      throw new HttpError(HTTP_UNAUTHORIZED, result.error);
    }

    request.user = result.user;

    return true;
  }
}

/** Exige empresa cadastrada. Use depois do `JwtAuthGuard`. */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (isTenantMissing(requestOf(context).user)) {
      throw new HttpError(HTTP_FORBIDDEN, ACCESS_MESSAGES.tenantRequired);
    }

    return true;
  }
}

/** Exige e-mail confirmado (quando `REQUIRE_EMAIL_VERIFICATION` está ligado). */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (isEmailVerificationPending(requestOf(context).user)) {
      throw new HttpError(HTTP_FORBIDDEN, ACCESS_MESSAGES.emailNotVerified);
    }

    return true;
  }
}

/** Exige papel ADMIN no tenant. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!isAdmin(requestOf(context).user)) {
      throw new HttpError(HTTP_FORBIDDEN, ACCESS_MESSAGES.adminRequired);
    }

    return true;
  }
}
