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
import type { FastifyInstance, InjectOptions, RouteOptions } from "fastify";

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

/** Rotas com `requireAdminHook` no código Fastify original (commit 5ed394f). */
const ADMIN_ROUTES = [
  "POST /api/products",
  "POST /api/products/import-spreadsheet",
  "POST /api/products/bulk-upsert",
  "PATCH /api/products/:id",
  "DELETE /api/products/:id",
  "DELETE /api/ctes/:chave",
  "POST /api/nfes/inutilizar",
  "GET /api/nfes/:chave/devolucao",
  "POST /api/nfes/:chave/devolucao",
  "POST /api/nfes/:chave/insulcesso",
  "POST /api/nfes/:chave/retorno-fisico",
  "GET /api/nfes/:chave/conferencia",
  "POST /api/nfes/:chave/conferencia",
  "POST /api/nfes/:chave/cancelamento",
  "DELETE /api/nfes/:chave",
  "PATCH /api/fiscal-settings",
  "POST /api/fiscal-validation/backfill",
  "POST /api/unidades-logisticas/bulk-import",
  "POST /api/movimentacoes/remessa",
  "POST /api/movimentacoes/transferencia-filial",
  "POST /api/movimentacoes/avanco-cd",
  "POST /api/movimentacoes/remessa/realign-fifo",
  "POST /api/empresas/filiais",
  "PUT /api/empresas/filiais/:id",
  "DELETE /api/empresas/filiais/:id",
  "PATCH /api/empresas/papeis-fiscais",
  "POST /api/users",
  "PATCH /api/users/:id",
  "DELETE /api/users/:id",
  "POST /api/pedidos/:id/faturar",
  "POST /api/pedidos/checkout",
  "POST /api/tax-rules/bulk-upsert",
  "POST /api/tax-rules/import-spreadsheet",
  "DELETE /api/tax-rules",
] as const;

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

/** Sobe a API e devolve a instância Fastify, que atende as rotas legadas e as do Nest. */
async function startApp(options: FakePrismaOptions = {}, onRoute?: (route: RouteOptions) => void) {
  const nest = await buildApp({ logger: false, prisma: createFakePrisma(options) as never, onRoute });
  const app = nest.getHttpAdapter().getInstance() as FastifyInstance;
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

  it("responde 403 em toda rota ADMIN para usuário MEMBER", async () => {
    const app = await startApp();
    const headers = bearer(accessToken(app));

    try {
      for (const route of ADMIN_ROUTES) {
        const [method, url] = route.split(" ");
        const res = await app.inject({ method: method as never, url: fillPathParams(url!), payload: {}, headers });

        assert.equal(res.statusCode, 403, route);
        assert.deepEqual(res.json(), { error: MESSAGES.adminRequired }, route);
      }
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

  it("GET /api/products/spreadsheet/template devolve o XLSX como anexo", async () => {
    const res = await app.inject({ method: "GET", url: "/api/products/spreadsheet/template", headers: bearer(token) });

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["content-type"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    assert.equal(res.headers["content-disposition"], 'attachment; filename="produtos-modelo.xlsx"');
    // XLSX é um ZIP: começa com "PK".
    assert.equal(res.rawPayload.subarray(0, 2).toString(), "PK");
  });

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

/** Corpo multipart com um único campo de arquivo `file`. */
function multipartFile(fileName: string, content: string) {
  const boundary = "----contract-boundary";
  const payload = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${fileName}"`,
    "Content-Type: application/octet-stream",
    "",
    content,
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return { payload, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

describe("contrato HTTP — uploads de planilha (ADMIN)", () => {
  let app: FastifyInstance;
  let headers: Record<string, string>;

  before(async () => {
    app = await startApp({ user: { role: "ADMIN" } });
    headers = bearer(accessToken(app));
  });
  after(() => app.close());

  const NOT_MULTIPART = "Envie a planilha como multipart/form-data (campo file)";

  const CASES = [
    { url: "/api/tax-rules/import-spreadsheet", json: { status: 400, body: { error: NOT_MULTIPART } }, badFormat: "Formato inválido. Envie um arquivo .xlsx ou .xls" },
    { url: "/api/products/import-spreadsheet", json: { status: 400, body: { error: NOT_MULTIPART } }, badFormat: "Formato inválido. Envie um arquivo .xlsx ou .csv" },
    { url: "/api/unidades-logisticas/bulk-import", json: null, badFormat: "Formato inválido. Envie um arquivo .xlsx ou .xls" },
  ] as const;

  for (const testCase of CASES) {
    it(`POST ${testCase.url} recusa arquivo com extensão inválida`, async () => {
      const file = multipartFile("dados.txt", "abc");
      const res = await app.inject({
        method: "POST",
        url: testCase.url,
        payload: file.payload,
        headers: { ...headers, ...file.headers },
      });

      assert.equal(res.statusCode, 400);
      assert.deepEqual(res.json(), { error: testCase.badFormat });
    });

    if (testCase.json) {
      const expected = testCase.json;
      it(`POST ${testCase.url} recusa corpo que não é multipart`, async () => {
        const res = await app.inject({ method: "POST", url: testCase.url, payload: {}, headers });

        assert.equal(res.statusCode, expected.status);
        assert.deepEqual(res.json(), expected.body);
      });
    }
  }

  const MOVEMENT_VALIDATION_CASES = [
    { method: "POST", url: "/api/movimentacoes/remessa", error: "Payload inválido" },
    { method: "POST", url: "/api/movimentacoes/transferencia-filial", error: "Payload inválido" },
    { method: "POST", url: "/api/movimentacoes/avanco-cd", error: "Payload inválido" },
    { method: "POST", url: "/api/movimentacoes/remessa/realign-fifo", error: "SKU obrigatório" },
    { method: "GET", url: "/api/movimentacoes/saldo-cd", error: "productId obrigatório" },
  ] as const;

  for (const testCase of MOVEMENT_VALIDATION_CASES) {
    it(`${testCase.method} ${testCase.url} inválido devolve 400 "${testCase.error}" com details do flatten()`, async () => {
      const res = await app.inject({
        method: testCase.method,
        url: testCase.url,
        ...(testCase.method === "POST" ? { payload: {} } : {}),
        headers,
      });
      const body = res.json();

      assert.equal(res.statusCode, 400);
      assert.equal(body.error, testCase.error);
      assert.deepEqual(Object.keys(body.details).sort(), ["fieldErrors", "formErrors"]);
    });
  }

  it("GET /api/unidades-logisticas/:id inexistente devolve 404", async () => {
    const res = await app.inject({ method: "GET", url: `/api/unidades-logisticas/${SAMPLE_ID}`, headers });

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.json(), { error: "Unidade não encontrada" });
  });

  it("POST /api/unidades-logisticas/bulk-import com JSON inválido devolve 400 com details", async () => {
    const res = await app.inject({ method: "POST", url: "/api/unidades-logisticas/bulk-import", payload: {}, headers });
    const body = res.json();

    assert.equal(res.statusCode, 400);
    assert.equal(body.error, "Payload inválido");
    assert.ok(body.details);
  });
});

describe("contrato HTTP — rate limit", () => {
  const PROTECTED_API_MAX_PER_MINUTE = 300;
  const LOGIN_MAX_PER_WINDOW = 10;

  async function statusesOf(app: FastifyInstance, count: number, request: InjectOptions) {
    const statuses: number[] = [];
    for (let i = 0; i < count; i += 1) {
      statuses.push((await app.inject(request)).statusCode);
    }

    return statuses;
  }

  it("API protegida divide 300 requisições autenticadas por minuto entre as rotas e depois responde 429", async () => {
    const app = await startApp();
    const headers = bearer(accessToken(app));

    try {
      const statuses = await statusesOf(app, PROTECTED_API_MAX_PER_MINUTE, { method: "GET", url: "/api/pedidos", headers });
      const blocked = await app.inject({ method: "GET", url: "/api/products", headers });

      assert.ok(statuses.every(status => status === 200));
      assert.equal(blocked.statusCode, 429);
      assert.deepEqual(blocked.json(), { error: "Rate limit exceeded, retry in 1 minute" });
    } finally {
      await app.close();
    }
  });

  it("API protegida não conta requisições sem token (o JWT é checado antes do limite)", async () => {
    const app = await startApp();

    try {
      const statuses = await statusesOf(app, PROTECTED_API_MAX_PER_MINUTE + 1, { method: "GET", url: "/api/pedidos" });

      assert.ok(statuses.every(status => status === 401));
    } finally {
      await app.close();
    }
  });

  it("login responde 403 (ban: 0) a partir da 11ª tentativa na janela", async () => {
    const app = await startApp();

    try {
      const request = { method: "POST", url: "/api/auth/login", payload: {} } as const;
      const statuses = await statusesOf(app, LOGIN_MAX_PER_WINDOW, request);
      const blocked = await app.inject(request);

      assert.ok(statuses.every(status => status === 400));
      assert.equal(blocked.statusCode, 403);
      assert.deepEqual(blocked.json(), { error: "Rate limit exceeded, retry in 15 minutes" });
    } finally {
      await app.close();
    }
  });

  it("lookup não tem rate limit (o limite de 30/min nunca foi aplicado; ver lookup-rate-limit.ts)", async () => {
    const app = await startApp();
    const INTENDED_LOOKUP_MAX_PER_MINUTE = 30;

    try {
      // CNPJ inválido falha na validação, sem chamar a API externa.
      const request = { method: "GET", url: "/api/lookup/cnpj/abc", headers: bearer(accessToken(app)) } as const;
      const statuses = await statusesOf(app, INTENDED_LOOKUP_MAX_PER_MINUTE + 1, request);

      assert.ok(statuses.every(status => status === 400));
    } finally {
      await app.close();
    }
  });

  it("health e /auth/me não têm rate limit", async () => {
    const app = await startApp();

    try {
      const health = await statusesOf(app, PROTECTED_API_MAX_PER_MINUTE + 1, { method: "GET", url: "/api/health" });
      const me = await statusesOf(app, PROTECTED_API_MAX_PER_MINUTE + 1, { method: "GET", url: "/api/auth/me" });

      assert.ok(health.every(status => status === 200));
      assert.ok(me.every(status => status === 401));
    } finally {
      await app.close();
    }
  });
});

describe("contrato HTTP — documentos fiscais", () => {
  const ACCESS_KEY = "3".repeat(44);
  let app: FastifyInstance;
  let headers: Record<string, string>;

  before(async () => {
    app = await startApp({ user: { role: "ADMIN" } });
    headers = bearer(accessToken(app));
  });
  after(() => app.close());

  const NOT_FOUND_CASES = [
    { url: `/api/nfes/${ACCESS_KEY}/xml`, error: "NF-e não encontrada" },
    { url: `/api/nfes/${ACCESS_KEY}/xml?doc=evento`, error: "Evento de cancelamento não encontrado para esta NF-e" },
    { url: `/api/nfes/${ACCESS_KEY}`, error: "NF-e não encontrada" },
    { url: `/api/ctes/${ACCESS_KEY}/xml`, error: "CT-e não encontrado" },
    { url: `/api/ctes/${ACCESS_KEY}`, error: "CT-e não encontrado" },
    { url: "/api/fiscal-events/inut-1/xml", error: "Inutilização não encontrada" },
  ] as const;

  for (const testCase of NOT_FOUND_CASES) {
    it(`GET ${testCase.url} sem documento devolve 404`, async () => {
      const res = await app.inject({ method: "GET", url: testCase.url, headers });

      assert.equal(res.statusCode, 404);
      assert.deepEqual(res.json(), { error: testCase.error });
    });
  }

  it("DELETE /api/nfes/:chave inexistente devolve 404", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/nfes/${ACCESS_KEY}`, headers });

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.json(), { error: "NF-e não encontrada" });
  });

  it("GET /api/nfes/:chave com chave fora do formato devolve 400 Zod", async () => {
    const res = await app.inject({ method: "GET", url: "/api/nfes/123", headers });

    assert.equal(res.statusCode, 400);
    assert.deepEqual(Object.keys(res.json()).sort(), ["details", "error"]);
  });

  it("POST /api/nfes/inutilizar sem corpo devolve 400 Zod", async () => {
    const res = await app.inject({ method: "POST", url: "/api/nfes/inutilizar", headers });

    assert.equal(res.statusCode, 400);
    assert.deepEqual(Object.keys(res.json()).sort(), ["details", "error"]);
  });

  it("POST /api/nfes/:chave/cancelamento com justificativa curta devolve 400 Zod", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/nfes/${ACCESS_KEY}/cancelamento`,
      payload: { xJust: "curta" },
      headers,
    });

    assert.equal(res.statusCode, 400);
    assert.ok(res.json().details.xJust);
  });

  for (const url of ["/api/audit-logs", "/api/timeline/steps"]) {
    it(`GET ${url} devolve lista vazia`, async () => {
      const res = await app.inject({ method: "GET", url, headers });

      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.json(), []);
    });
  }
});

describe("contrato HTTP — tenant e usuários (org)", () => {
  const OWN_TENANT_ID = "11111111-1111-4111-8111-111111111111";
  let app: FastifyInstance;
  let headers: Record<string, string>;

  before(async () => {
    app = await startApp({ user: { tenantId: OWN_TENANT_ID } });
    headers = bearer(accessToken(app));
  });
  after(() => app.close());

  it("GET /api/tenants/:id de outra empresa devolve 404", async () => {
    const res = await app.inject({ method: "GET", url: `/api/tenants/${SAMPLE_ID}`, headers });

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.json(), { error: "Empresa não encontrada" });
  });

  it("PATCH /api/tenants/:id de outra empresa devolve 404 antes de validar o corpo", async () => {
    const res = await app.inject({ method: "PATCH", url: `/api/tenants/${SAMPLE_ID}`, payload: { cnpj: 1 }, headers });

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.json(), { error: "Empresa não encontrada" });
  });

  it("POST /api/tenants é bloqueado com 403", async () => {
    const res = await app.inject({ method: "POST", url: "/api/tenants", payload: {}, headers });

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.json(), { error: "Cadastro de empresas não disponível via API autenticada" });
  });

  it("DELETE /api/tenants/:id responde 403 para a própria empresa e 404 para outra", async () => {
    const own = await app.inject({ method: "DELETE", url: `/api/tenants/${OWN_TENANT_ID}`, headers });
    const other = await app.inject({ method: "DELETE", url: `/api/tenants/${SAMPLE_ID}`, headers });

    assert.equal(own.statusCode, 403);
    assert.deepEqual(own.json(), { error: "Exclusão de empresa não permitida" });
    assert.equal(other.statusCode, 404);
  });

  it("GET /api/users/:id com id inválido devolve 400 { error, details }", async () => {
    const res = await app.inject({ method: "GET", url: "/api/users/abc", headers });

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.json(), { error: "ID inválido", details: { id: ["ID inválido"] } });
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
