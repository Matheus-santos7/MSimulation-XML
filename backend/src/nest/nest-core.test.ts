import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import fastifyJwt from "@fastify/jwt";
import { Body, Controller, Get, HttpCode, Module, Post, UseFilters, UseInterceptors } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { ACCESS_MESSAGES } from "../lib/auth/access-control.js";
import { getDbClient, getDbRequestContext } from "../lib/db/tenant-rls.js";
import { HttpError } from "../lib/http/http-error.js";
import { createRateLimitHandler, registerRootRateLimit, strictRouteRateLimit } from "../lib/http/rate-limit.js";
import { AdminOnly, ProtectedApi } from "./api-access.decorators.js";
import { TenantId } from "./auth/request-params.js";
import { CoreModule } from "./core.module.js";
import { ApiExceptionFilter, RouteErrorFilter } from "./http/api-exception.filter.js";
import { RateLimit, RateLimitInterceptor } from "./http/rate-limit.interceptor.js";
import { ZodValidationPipe } from "./http/zod-validation.pipe.js";

const JWT_SECRET = "nest-core-test-secret-0123456789";
const TENANT_ID = "tenant-1";
const USER_ID = "user-1";
const PROTECTED_MAX = 3;
const GENEROUS_PROTECTED_MAX = 1000;
const ROUTE_MAX = 2;

type UserRow = { tokenVersion: number; tenantId: string | null; role: "ADMIN" | "MEMBER"; emailVerifiedAt: Date | null };

const VERIFIED_MEMBER: UserRow = { tokenVersion: 1, tenantId: TENANT_ID, role: "MEMBER", emailVerifiedAt: new Date() };

class OutOfStockError extends Error {
  constructor(readonly available: number) {
    super("Sem saldo");
  }
}

const itemBody = z.object({ name: z.string().min(1, "Nome obrigatório") });

/** Estado do Prisma fake, reiniciado a cada teste. */
const db = {
  user: VERIFIED_MEMBER,
  rlsCalls: [] as unknown[][],
  transactions: 0,
};

const fakeTx = {
  $executeRaw: async (...args: unknown[]) => {
    db.rlsCalls.push(args);

    return 0;
  },
};

const fakePrisma = {
  user: { findUnique: async () => db.user },
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
    db.transactions += 1;

    return fn(fakeTx);
  },
};

const outOfStockMapping = {
  type: OutOfStockError,
  status: 422,
  toBody: (error: Error) => ({ error: error.message, disponivel: (error as OutOfStockError).available }),
};

@Controller("items")
@ProtectedApi()
@UseFilters(new RouteErrorFilter({ mappings: [outOfStockMapping] }))
class ItemsController {
  @Get()
  list(@TenantId() tenantId: string) {
    return { tenantId, sameTransaction: getDbClient() === fakeTx, context: getDbRequestContext() };
  }

  @Post()
  @HttpCode(201)
  create(@Body(new ZodValidationPipe(itemBody)) body: z.infer<typeof itemBody>) {
    return body;
  }

  @Post("admin")
  @AdminOnly()
  @HttpCode(200)
  adminOnly() {
    return { ok: true };
  }

  @Get("out-of-stock")
  outOfStock() {
    throw new OutOfStockError(4);
  }

  @Get("http-error")
  httpError() {
    throw new HttpError(409, "Conflito", { error: "Conflito", campo: "x" });
  }

  @Get("crash")
  crash() {
    throw new Error("detalhe interno");
  }
}

@Controller("public")
@UseInterceptors(RateLimitInterceptor)
class PublicController {
  @Get("limited")
  @RateLimit(strictRouteRateLimit(ROUTE_MAX, "1 minute"))
  limited() {
    return { ok: true };
  }
}

async function buildTestApp(
  protectedMax = GENEROUS_PROTECTED_MAX,
): Promise<{ nest: NestFastifyApplication; fastify: FastifyInstance }> {
  const fastify = Fastify({ logger: false });
  await fastify.register(fastifyJwt, { secret: JWT_SECRET });
  await registerRootRateLimit(fastify);

  @Module({
    imports: [
      CoreModule.register({
        prisma: fakePrisma as never,
        rateLimits: {
          protectedApi: createRateLimitHandler(fastify, { max: protectedMax, timeWindow: "1 minute" }),
          create: options => createRateLimitHandler(fastify, options),
        },
      }),
    ],
    controllers: [ItemsController, PublicController],
  })
  class TestModule {}

  const nest = await NestFactory.create<NestFastifyApplication>(TestModule, new FastifyAdapter(fastify), {
    bodyParser: false,
    logger: false,
    abortOnError: false,
  });
  nest.setGlobalPrefix("api");
  nest.useGlobalFilters(new ApiExceptionFilter());
  await nest.init();

  return { nest, fastify };
}

function accessToken(fastify: FastifyInstance): string {
  return fastify.jwt.sign({ userId: USER_ID, tenantId: TENANT_ID, tokenVersion: 1, typ: "access" });
}

describe("Nest core — guards, RLS, filtros e rate limit", () => {
  let nest: NestFastifyApplication;
  let fastify: FastifyInstance;
  let headers: Record<string, string>;

  before(async () => {
    ({ nest, fastify } = await buildTestApp());
    headers = { authorization: `Bearer ${accessToken(fastify)}` };
  });
  after(() => nest.close());

  beforeEach(() => {
    db.user = VERIFIED_MEMBER;
    db.rlsCalls = [];
    db.transactions = 0;
  });

  it("responde 401 sem token e não abre transação", async () => {
    const res = await fastify.inject({ method: "GET", url: "/api/items" });

    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.json(), { error: ACCESS_MESSAGES.unauthorized });
    assert.equal(db.transactions, 0);
  });

  it("responde 401 quando o tokenVersion mudou", async () => {
    db.user = { ...VERIFIED_MEMBER, tokenVersion: 2 };

    const res = await fastify.inject({ method: "GET", url: "/api/items", headers });

    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.json(), { error: ACCESS_MESSAGES.sessionEnded });
  });

  it("responde 403 sem empresa", async () => {
    db.user = { ...VERIFIED_MEMBER, tenantId: null };

    const res = await fastify.inject({ method: "GET", url: "/api/items", headers });

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.json(), { error: ACCESS_MESSAGES.tenantRequired });
  });

  it("responde 403 com e-mail não confirmado", async () => {
    db.user = { ...VERIFIED_MEMBER, emailVerifiedAt: null };

    const res = await fastify.inject({ method: "GET", url: "/api/items", headers });

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.json(), { error: ACCESS_MESSAGES.emailNotVerified });
  });

  it("responde 403 em rota ADMIN para MEMBER e libera para ADMIN", async () => {
    const denied = await fastify.inject({ method: "POST", url: "/api/items/admin", headers });
    db.user = { ...VERIFIED_MEMBER, role: "ADMIN" };
    const allowed = await fastify.inject({ method: "POST", url: "/api/items/admin", headers });

    assert.equal(denied.statusCode, 403);
    assert.deepEqual(denied.json(), { error: ACCESS_MESSAGES.adminRequired });
    assert.equal(allowed.statusCode, 200);
  });

  it("roda o handler dentro da transação com o contexto de RLS do usuário", async () => {
    const res = await fastify.inject({ method: "GET", url: "/api/items", headers });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), {
      tenantId: TENANT_ID,
      sameTransaction: true,
      context: { userId: USER_ID, tenantId: TENANT_ID },
    });
    assert.equal(db.transactions, 1);
    // set_config de tenant e de usuário, depois a limpeza dos dois.
    assert.equal(db.rlsCalls.length, 4);
    assert.ok(db.rlsCalls[0]!.includes(TENANT_ID));
    assert.ok(db.rlsCalls[1]!.includes(USER_ID));
  });

  it("valida o corpo com Zod e responde 400 { error, details }", async () => {
    const res = await fastify.inject({ method: "POST", url: "/api/items", headers, payload: { name: "" } });

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.json(), { error: "Nome obrigatório", details: { name: ["Nome obrigatório"] } });
  });

  it("aceita corpo válido com o status declarado", async () => {
    const res = await fastify.inject({ method: "POST", url: "/api/items", headers, payload: { name: "Caixa" } });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.json(), { name: "Caixa" });
  });

  it("aplica o mapeamento de erro de domínio da rota", async () => {
    const res = await fastify.inject({ method: "GET", url: "/api/items/out-of-stock", headers });

    assert.equal(res.statusCode, 422);
    assert.deepEqual(res.json(), { error: "Sem saldo", disponivel: 4 });
  });

  it("responde HttpError com o corpo informado", async () => {
    const res = await fastify.inject({ method: "GET", url: "/api/items/http-error", headers });

    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.json(), { error: "Conflito", campo: "x" });
  });

  it("esconde o detalhe de erro não tratado (500 genérico)", async () => {
    const res = await fastify.inject({ method: "GET", url: "/api/items/crash", headers });

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.json(), { error: "Erro interno do servidor" });
  });

  it("aplica o limite próprio da rota com bloqueio 403", async () => {
    const statuses: number[] = [];
    for (let i = 0; i <= ROUTE_MAX; i += 1) {
      statuses.push((await fastify.inject({ method: "GET", url: "/api/public/limited" })).statusCode);
    }

    assert.deepEqual(statuses, [200, 200, 403]);
  });
});

describe("Nest core — limite compartilhado da API protegida", () => {
  it("conta só requisições autenticadas e divide o limite entre as rotas", async () => {
    const { nest, fastify } = await buildTestApp(PROTECTED_MAX);
    const headers = { authorization: `Bearer ${accessToken(fastify)}` };
    db.user = VERIFIED_MEMBER;

    try {
      const unauthenticated = await fastify.inject({ method: "GET", url: "/api/items" });
      const statuses: number[] = [];
      for (let i = 0; i < PROTECTED_MAX; i += 1) {
        statuses.push((await fastify.inject({ method: "GET", url: "/api/items", headers })).statusCode);
      }
      const blocked = await fastify.inject({ method: "POST", url: "/api/items", headers, payload: { name: "x" } });

      assert.equal(unauthenticated.statusCode, 401);
      assert.deepEqual(statuses, [200, 200, 200]);
      assert.equal(blocked.statusCode, 429);
      assert.deepEqual(blocked.json(), { error: "Rate limit exceeded, retry in 1 minute" });
    } finally {
      await nest.close();
    }
  });
});
