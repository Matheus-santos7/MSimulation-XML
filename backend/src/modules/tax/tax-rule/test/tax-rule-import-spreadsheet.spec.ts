/**
 * Integração do import de planilha de regras tributárias:
 * upload multipart -> parse -> map -> upsert (Postgres real com RLS) -> resposta.
 *
 * Precisa de um Postgres descartável e VAZIO em `TAX_IMPORT_TEST_DATABASE_URL`
 * (ex.: postgresql://msimulation:msimulation@localhost:5433/msimulation_tax_import_test).
 * As migrations (RLS incluída) são aplicadas no `beforeAll`. Sem a variável, a suíte é pulada.
 * Só aceita host local: nunca aponte para o banco de produção.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import * as XLSX from "xlsx";
import type { FastifyInstance } from "fastify";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

process.env.JWT_SECRET ??= "import-test-secret-0123456789";

const databaseUrl = process.env.TAX_IMPORT_TEST_DATABASE_URL;
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1"];

const TENANT_ID = "test-tenant-01";
const OTHER_TENANT_ID = "test-tenant-02";
const USER_ID = "test-user-01";
const SHEET_NAME = "Regras tributárias";
const BOUNDARY = "----taxruleimportboundary";
const ENDPOINT = "/api/tax-rules/import-spreadsheet";
const HEADER_KEYS = [
  "RULE_ID",
  "RULE_NAME",
  "ORIGIN",
  "TRANSACTION_TYPE",
  "IPI_ST",
  "IPI_ALIQUOTA",
  "ICMS_SP_PICMS_INTERNAL",
];
const HEADER_LABELS = HEADER_KEYS.map((key) => `label ${key}`);

type Cell = string | number;

function validRow(index: number, icms: number = 18): Cell[] {
  return [`10000${index}`, `Regra ${index}`, "SP", "Contribuinte", "99", 0, icms];
}

/** Linha com RULE_ID novo e sem ORIGIN: o parser não tem de onde herdar a origem. */
function rowWithoutOrigin(index: number): Cell[] {
  return [`20000${index}`, `Sem origem ${index}`, "", "Contribuinte", "99", 0, 18];
}

function buildXlsx(dataRows: Cell[][], sheetName: string = SHEET_NAME): Buffer {
  const rows = [HEADER_KEYS.map(() => ""), HEADER_KEYS, HEADER_LABELS, ...dataRows];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);

  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

function multipartBody(file: Buffer, fileName: string): Buffer {
  const head =
    `--${BOUNDARY}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
    `Content-Type: application/octet-stream\r\n\r\n`;

  return Buffer.concat([Buffer.from(head), file, Buffer.from(`\r\n--${BOUNDARY}--\r\n`)]);
}

describe.skipIf(!databaseUrl)("POST /api/tax-rules/import-spreadsheet (Postgres real)", () => {
  let nest: NestFastifyApplication;
  let app: FastifyInstance;
  let prisma: import("../../../../generated/prisma/client.js").PrismaClient;
  let runWithDbContext: typeof import("../../../../lib/db/tenant-rls.js").runWithDbContext;
  let token: string;

  function importFile(file: Buffer, fileName = "regras.xlsx") {
    return app.inject({
      method: "POST",
      url: ENDPOINT,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": `multipart/form-data; boundary=${BOUNDARY}`,
      },
      payload: multipartBody(file, fileName),
    });
  }

  function storedRules(tenantId: string = TENANT_ID) {
    return runWithDbContext(prisma, { tenantId }, (tx) =>
      tx.taxRule.findMany({ where: { tenantId }, orderBy: { ruleId: "asc" } }),
    );
  }

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    assert.ok(LOCAL_HOSTS.includes(url.hostname), "O teste só roda contra Postgres local");

    execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
      cwd: new URL("../../../../../", import.meta.url),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "pipe",
    });

    const { PrismaClient } = await import("../../../../generated/prisma/client.js");
    ({ runWithDbContext } = await import("../../../../lib/db/tenant-rls.js"));
    prisma = new PrismaClient({
      adapter: new PrismaPg(new pg.Pool({ connectionString: databaseUrl, max: 5 })),
    });

    for (const [index, id] of [TENANT_ID, OTHER_TENANT_ID].entries()) {
      await prisma.tenant.upsert({
        where: { id },
        update: {},
        create: {
          id,
          razaoSocial: "Empresa Teste",
          nomeFantasia: "Teste",
          cnpj: `0000000000019${index}`,
          ie: "ISENTO",
          logradouro: "Rua A",
          bairro: "Centro",
          codigoMunicipio: "3550308",
          municipio: "São Paulo",
          uf: "SP",
          cep: "01001000",
          ambiente: "HOMOLOGACAO",
        },
      });
    }
    await prisma.user.upsert({
      where: { id: USER_ID },
      update: {},
      create: {
        id: USER_ID,
        tenantId: TENANT_ID,
        email: "admin@import.test",
        password: "not-used",
        role: "ADMIN",
        tokenVersion: 1,
        emailVerifiedAt: new Date(),
      },
    });

    const { buildApp } = await import("../../../../app.js");
    nest = await buildApp({ logger: false, prisma });
    app = nest.getHttpAdapter().getInstance() as FastifyInstance;
    await app.ready();
    token = app.jwt.sign({ userId: USER_ID, tenantId: TENANT_ID, tokenVersion: 1, typ: "access" });
  }, 120_000);

  afterAll(async () => {
    await nest?.close();
  });

  beforeEach(async () => {
    for (const tenantId of [TENANT_ID, OTHER_TENANT_ID]) {
      await runWithDbContext(prisma, { tenantId }, (tx) => tx.taxRule.deleteMany({ where: { tenantId } }));
    }
  });

  it("importa planilha válida e responde created/updated/total", async () => {
    const file = buildXlsx([1, 2, 3, 4, 5].map((i) => validRow(i)));

    const res = await importFile(file);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { created: 5, updated: 0, total: 5 });
  });

  it("grava no banco as 5 regras do tenant com origem e alíquota", async () => {
    const file = buildXlsx([1, 2, 3, 4, 5].map((i) => validRow(i)));

    await importFile(file);

    const rules = await storedRules();
    assert.equal(rules.length, 5);
    assert.deepEqual(
      rules.map((rule) => rule.ruleId),
      [1, 2, 3, 4, 5].map((i) => `10000${i}-SP-taxpayer-sale`),
    );
    assert.ok(rules.every((rule) => rule.origin === "SP" && rule.aliquota === "18"));
  });

  it("não grava regras em outro tenant", async () => {
    await importFile(buildXlsx([validRow(1)]));

    assert.equal((await storedRules(OTHER_TENANT_ID)).length, 0);
  });

  it("atualiza as regras alteradas ao reimportar a planilha", async () => {
    await importFile(buildXlsx([1, 2, 3].map((i) => validRow(i))));

    const res = await importFile(buildXlsx([validRow(1, 12), validRow(2, 7), validRow(3)]));

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { created: 0, updated: 3, total: 3 });
  });

  it("persiste a nova alíquota das regras reimportadas e mantém as demais", async () => {
    await importFile(buildXlsx([1, 2, 3].map((i) => validRow(i))));

    await importFile(buildXlsx([validRow(1, 12), validRow(2, 7), validRow(3)]));

    const rules = await storedRules();
    assert.equal(rules.length, 3);
    assert.deepEqual(
      rules.map((rule) => rule.aliquota),
      ["12", "7", "18"],
    );
  });

  it("conta como criada só a regra nova ao reimportar com uma linha a mais", async () => {
    await importFile(buildXlsx([1, 2, 3].map((i) => validRow(i))));

    const res = await importFile(buildXlsx([1, 2, 3, 4].map((i) => validRow(i))));

    assert.deepEqual(res.json(), { created: 1, updated: 3, total: 4 });
  });

  it("importa as linhas válidas e devolve parseErrors das inválidas", async () => {
    const file = buildXlsx([
      rowWithoutOrigin(1),
      rowWithoutOrigin(2),
      ...[1, 2, 3, 4, 5].map((i) => validRow(i)),
    ]);

    const res = await importFile(file);

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.created, 5);
    assert.equal(body.total, 5);
    assert.equal(body.parseErrors.length, 2);
    assert.ok(body.parseErrors.every((e: { message: string }) => /ORIGIN/.test(e.message)));
  });

  it("persiste só as linhas válidas quando há parseErrors", async () => {
    const file = buildXlsx([
      rowWithoutOrigin(1),
      rowWithoutOrigin(2),
      ...[1, 2, 3, 4, 5].map((i) => validRow(i)),
    ]);

    await importFile(file);

    assert.equal((await storedRules()).length, 5);
  });

  it("responde 400 quando nenhuma linha é válida", async () => {
    const res = await importFile(buildXlsx([rowWithoutOrigin(1), rowWithoutOrigin(2)]));

    assert.equal(res.statusCode, 400);
    assert.match(res.json().error, /ORIGIN|Nenhuma regra válida/);
    assert.equal((await storedRules()).length, 0);
  });

  it("responde 400 'Nenhuma regra válida' quando a aba não tem linhas de dados além do cabeçalho", async () => {
    // Menos de 4 linhas na matriz: "Planilha sem linhas de dados".
    const res = await importFile(buildXlsx([]));

    assert.equal(res.statusCode, 400);
    assert.match(res.json().error, /Planilha sem linhas de dados/);
  });

  it("responde 400 para arquivo com bytes aleatórios", async () => {
    const garbage = Buffer.from("isto nao e uma planilha excel, apenas texto qualquer");

    const res = await importFile(garbage);

    assert.equal(res.statusCode, 400);
    assert.match(res.json().error, /Conteúdo inválido|Arquivo inválido/);
  });

  it("não grava nada quando o arquivo é inválido", async () => {
    await importFile(Buffer.from("lixo binario"));

    assert.equal((await storedRules()).length, 0);
  });

  it("responde 400 'Arquivo vazio' ou pede o arquivo quando o upload tem 0 bytes", async () => {
    const res = await importFile(Buffer.alloc(0));

    assert.equal(res.statusCode, 400);
    // O upload trata 0 bytes antes da validação de conteúdo.
    assert.match(res.json().error, /Arquivo vazio|Envie o arquivo Excel/);
  });

  it("responde 400 quando a aba 'Regras tributárias' não existe", async () => {
    const res = await importFile(buildXlsx([validRow(1)], "Other Sheet"));

    assert.equal(res.statusCode, 400);
    assert.match(res.json().error, /Aba 'Regras tributárias' não encontrada/);
  });

  it("responde 400 quando a extensão não é xlsx", async () => {
    const res = await importFile(buildXlsx([validRow(1)]), "regras.csv");

    assert.equal(res.statusCode, 400);
    assert.match(res.json().error, /Formato inválido/);
  });
});
