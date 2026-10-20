/**
 * Contrato HTTP da API (rede de segurança da migração para NestJS).
 *
 * Sobe o app real com um Prisma fake (banco vazio) e confere status e corpo
 * das respostas que o frontend consome. Não precisa de banco nem de rede.
 *
 * Snapshot de rotas: `app.contract.routes.txt`. Para regravar depois de uma
 * mudança intencional de rota: `UPDATE_CONTRACT_SNAPSHOT=1 pnpm test`.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance, RouteOptions } from "fastify";

process.env.JWT_SECRET ??= "contract-test-secret-0123456789";

const { buildApp } = await import("./app.js");

const ROUTES_SNAPSHOT_PATH = new URL("./app.contract.routes.txt", import.meta.url);
const SAMPLE_ID = "00000000-0000-4000-8000-000000000000";
const USER_ID = "user-contract";
const TENANT_ID = "tenant-contract";
const TOKEN_VERSION = 1;

/** Rotas que não passam pelo hook de tenant (públicas, auth e lookup de onboarding). */
const TENANT_FREE_PREFIXES = ["/api/health", "/api/auth/", "/api/lookup/"];
/** Rotas sem JWT obrigatório no escopo (as de auth que exigem token usam hook próprio). */
const JWT_FREE_PREFIXES = ["/api/health", "/api/auth/"];

const MESSAGES = {
  unauthorized: "Não autorizado. Token ausente ou inválido.",
  sessionEnded: "Sessão encerrada. Entre novamente.",
  tenantRequired: "Cadastre uma empresa para continuar",
  emailNotVerified: "Confirme seu e-mail antes de continuar",
  adminRequired: "Apenas administradores podem executar esta ação",
  databaseUnavailable: "Banco de dados indisponível",
} as const;

type UserRow = {
  tokenVersion: number;
  tenantId: string | null;
  role: "ADMIN" | "MEMBER";
  emailVerifiedAt: Date | null;
};

type FakePrismaOptions = {
  user?: Partial<UserRow>;
  transactionError?: Error;
  queryRawError?: Error;
};

type ContractRoute = { method: string; url: string };

const DEFAULT_USER: UserRow = {
  tokenVersion: TOKEN_VERSION,
  tenantId: TENANT_ID,
  role: "MEMBER",
  emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
};

/** Model Prisma vazio: listas vazias, contagem zero, busca única nula. */
const emptyModel = new Proxy(
  {},
  {
    get: (_target, operation) => async () => {
      const name = String(operation);
      if (name.startsWith("findMany")) return [];
      if (name === "count") return 0;

      return null;
    },
  },
);

const fakeTransactionClient = new Proxy(
  {},
  {
    get: (_target, key) => {
      if (key === "$executeRaw" || key === "$queryRaw") return async () => [];
      // Evita que o Proxy seja tratado como thenable em `await`.
      if (key === "then") return undefined;

      return emptyModel;
    },
  },
);

function createFakePrisma(options: FakePrismaOptions = {}) {
  const user = { ...DEFAULT_USER, ...options.user };

  return {
    user: { findUnique: async () => user },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      if (options.transactionError) throw options.transactionError;

      return fn(fakeTransactionClient);
    },
    $queryRaw: async () => {
      if (options.queryRawError) throw options.queryRawError;

      return [{ ok: 1 }];
    },
    $disconnect: async () => {},
  };
}

async function startApp(options: FakePrismaOptions = {}, onRoute?: (route: RouteOptions) => void) {
  const app = await buildApp({ logger: false, prisma: createFakePrisma(options) as never, onRoute });
  await app.ready();

  return app;
}

function accessToken(app: FastifyInstance, tokenVersion = TOKEN_VERSION): string {
  return app.jwt.sign({ userId: USER_ID, tenantId: TENANT_ID, tokenVersion, typ: "access" });
}

function bearer(token: string) {
  return { authorization: `Bearer ${token}` };
}

function fillPathParams(url: string): string {
  return url.replace(/:[A-Za-z0-9_]+/g, SAMPLE_ID);
}

function startsWithAny(url: string, prefixes: readonly string[]): boolean {
  return prefixes.some(prefix => url.startsWith(prefix));
}

/** Rotas de negócio, sem HEAD automático e sem o `OPTIONS *` do CORS. */
function businessRoutes(routes: readonly string[]): ContractRoute[] {
  return routes
    .map(line => {
      const [method, url] = line.split(" ");

      return { method: method!, url: url! };
    })
    .filter(route => route.url.startsWith("/api/"));
}

async function collectRoutes(): Promise<string[]> {
  const routes: string[] = [];
  const app = await startApp({}, route => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    for (const method of methods) {
      if (method !== "HEAD") routes.push(`${method} ${route.url}`);
    }
  });
  await app.close();

  return [...new Set(routes)].sort();
}

const registeredRoutes = await collectRoutes();

describe("contrato HTTP — snapshot de rotas", () => {
  it("mantém o mesmo conjunto de métodos e paths", () => {
    const current = `${registeredRoutes.join("\n")}\n`;
    if (process.env.UPDATE_CONTRACT_SNAPSHOT === "1" || !existsSync(ROUTES_SNAPSHOT_PATH)) {
      writeFileSync(ROUTES_SNAPSHOT_PATH, current);
    }

    assert.equal(current, readFileSync(ROUTES_SNAPSHOT_PATH, "utf8"));
  });
});

describe("contrato HTTP — autenticação", () => {
  let app: FastifyInstance;

  before(async () => {
    app = await startApp();
  });
  after(() => app.close());

  it("responde 401 sem token em toda rota protegida", async () => {
    const protectedRoutes = businessRoutes(registeredRoutes).filter(
      route => !startsWithAny(route.url, JWT_FREE_PREFIXES),
    );
    assert.ok(protectedRoutes.length > 0);

    for (const route of protectedRoutes) {
      const res = await app.inject({ method: route.method as never, url: fillPathParams(route.url) });
      assert.equal(res.statusCode, 401, `${route.method} ${route.url}`);
      assert.deepEqual(res.json(), { error: MESSAGES.unauthorized }, `${route.method} ${route.url}`);
    }
  });

  it("responde 401 com token malformado", async () => {
    const res = await app.inject({ method: "GET", url: "/api/pedidos", headers: bearer("invalid.token.value") });

    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.json(), { error: MESSAGES.unauthorized });
  });

  it("responde 401 quando o tokenVersion do JWT não bate com o do usuário", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/pedidos",
      headers: bearer(accessToken(app, TOKEN_VERSION + 1)),
    });

    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.json(), { error: MESSAGES.sessionEnded });
  });
});

describe("contrato HTTP — guards de tenant, e-mail e papel", () => {
  it("responde 403 sem empresa em toda rota de negócio", async () => {
    const app = await startApp({ user: { tenantId: null } });
    const token = accessToken(app);
    const tenantRoutes = businessRoutes(registeredRoutes).filter(
      route => !startsWithAny(route.url, TENANT_FREE_PREFIXES),
    );

    try {
      for (const route of tenantRoutes) {
        const res = await app.inject({
          method: route.method as never,
          url: fillPathParams(route.url),
          headers: bearer(token),
        });
        assert.equal(res.statusCode, 403, `${route.method} ${route.url}`);
        assert.deepEqual(res.json(), { error: MESSAGES.tenantRequired }, `${route.method} ${route.url}`);
      }
    } finally {
      await app.close();
    }
  });

  it("responde 403 quando o e-mail não foi confirmado", async () => {
    const app = await startApp({ user: { emailVerifiedAt: null } });

    try {
      const res = await app.inject({ method: "GET", url: "/api/pedidos", headers: bearer(accessToken(app)) });

      assert.equal(res.statusCode, 403);
      assert.deepEqual(res.json(), { error: MESSAGES.emailNotVerified });
    } finally {
      await app.close();
    }
  });

  it("responde 403 em rota ADMIN para usuário MEMBER", async () => {
    const app = await startApp();

    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/pedidos/checkout",
        payload: {},
        headers: bearer(accessToken(app)),
      });

      assert.equal(res.statusCode, 403);
      assert.deepEqual(res.json(), { error: MESSAGES.adminRequired });
    } finally {
      await app.close();
    }
  });
});

describe("contrato HTTP — respostas por módulo (banco vazio)", () => {
  let app: FastifyInstance;
  let token: string;

  before(async () => {
    app = await startApp();
    token = accessToken(app);
  });
  after(() => app.close());

  const EMPTY_LIST_ROUTES = [
    "/api/pedidos",
    "/api/products",
    "/api/tax-rules",
    "/api/unidades-logisticas",
    "/api/movimentacoes-produto",
    "/api/nfes",
    "/api/ctes",
    "/api/timeline",
    "/api/fiscal-events",
    "/api/users",
    "/api/tenants",
    "/api/filiais",
  ];

  for (const url of EMPTY_LIST_ROUTES) {
    it(`GET ${url} devolve lista vazia`, async () => {
      const res = await app.inject({ method: "GET", url, headers: bearer(token) });

      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.json(), []);
    });
  }

  it("GET /api/pedidos/:id inexistente devolve 404", async () => {
    const res = await app.inject({ method: "GET", url: `/api/pedidos/${SAMPLE_ID}`, headers: bearer(token) });

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.json(), { error: "Pedido não encontrado" });
  });

  it("GET /api/fiscal-settings sem empresa no banco devolve 404", async () => {
    const res = await app.inject({ method: "GET", url: "/api/fiscal-settings", headers: bearer(token) });

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.json(), { error: "Empresa não encontrada" });
  });

  it("POST /api/pedidos com corpo inválido devolve 400 no formato { error, details }", async () => {
    const res = await app.inject({ method: "POST", url: "/api/pedidos", payload: {}, headers: bearer(token) });

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.json(), {
      error: "Required",
      details: { items: ["Required"], comprador: ["Required"] },
    });
  });

  it("POST /api/auth/login com corpo inválido devolve 400 no formato { error, details }", async () => {
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: {} });

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.json(), {
      error: "Required",
      details: { email: ["Required"], password: ["Required"] },
    });
  });
});

describe("contrato HTTP — health e banco indisponível", () => {
  it("GET /api/health responde ok com banco disponível", async () => {
    const app = await startApp();

    try {
      const res = await app.inject({ method: "GET", url: "/api/health" });
      const body = res.json();

      assert.equal(res.statusCode, 200);
      assert.equal(body.status, "ok");
      assert.equal(body.service, "api");
      assert.equal(body.database, "ok");
      assert.ok(!Number.isNaN(Date.parse(body.timestamp)));
    } finally {
      await app.close();
    }
  });

  it("GET /api/health responde 503 degraded quando o banco falha", async () => {
    const app = await startApp({ queryRawError: new Error("connect ECONNREFUSED 127.0.0.1:5432") });

    try {
      const res = await app.inject({ method: "GET", url: "/api/health" });

      assert.equal(res.statusCode, 503);
      assert.equal(res.json().status, "degraded");
      assert.equal(res.json().database, "unavailable");
    } finally {
      await app.close();
    }
  });

  it("rota protegida responde 503 quando a transação não conecta", async () => {
    const app = await startApp({ transactionError: new Error("connect ECONNREFUSED 127.0.0.1:5432") });

    try {
      const res = await app.inject({ method: "GET", url: "/api/pedidos", headers: bearer(accessToken(app)) });

      assert.equal(res.statusCode, 503);
      assert.deepEqual(res.json(), { error: MESSAGES.databaseUnavailable });
    } finally {
      await app.close();
    }
  });
});
