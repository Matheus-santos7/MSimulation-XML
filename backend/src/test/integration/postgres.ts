/**
 * Postgres descartável das specs de integração (`INTEGRATION_TEST_DATABASE_URL`, só host local).
 *
 * - `owner`: o usuário da URL (dono das tabelas, em geral superusuário). Ignora a RLS: só para seed.
 * - `app`: papel `msx_app` sem `BYPASSRLS` nem posse das tabelas, como a API deveria rodar.
 *   É o que prova que a RLS barra o outro tenant.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";

export const integrationDatabaseUrl = process.env.INTEGRATION_TEST_DATABASE_URL;

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1"];
const APP_ROLE = "msx_app";
const APP_PASSWORD = "msx_app";
const POOL_MAX = 10;

function makeClient(connectionString: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg(new pg.Pool({ connectionString, max: POOL_MAX })),
  });
}

export type IntegrationDb = {
  owner: PrismaClient;
  app: PrismaClient;
  close: () => Promise<void>;
};

/** Aplica as migrations, cria o papel sem `BYPASSRLS` e devolve os dois clientes. */
export async function setupIntegrationDb(): Promise<IntegrationDb> {
  assert.ok(integrationDatabaseUrl, "INTEGRATION_TEST_DATABASE_URL não definida");
  const ownerUrl = new URL(integrationDatabaseUrl);
  assert.ok(LOCAL_HOSTS.includes(ownerUrl.hostname), "O teste só roda contra Postgres local");

  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: new URL("../../../", import.meta.url),
    env: { ...process.env, DATABASE_URL: integrationDatabaseUrl },
    stdio: "pipe",
  });

  const owner = makeClient(integrationDatabaseUrl);
  // Specs rodam em paralelo: o lock evita corrida no CREATE ROLE.
  await owner.$transaction([
    owner.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('${APP_ROLE}'))`),
    owner.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
          CREATE ROLE ${APP_ROLE} LOGIN PASSWORD '${APP_PASSWORD}' NOSUPERUSER NOBYPASSRLS;
        END IF;
      END $$`),
    owner.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE}`),
    owner.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE}`,
    ),
    owner.$executeRawUnsafe(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_ROLE}`),
  ]);

  const appUrl = new URL(integrationDatabaseUrl);
  appUrl.username = APP_ROLE;
  appUrl.password = APP_PASSWORD;
  const app = makeClient(appUrl.toString());

  return {
    owner,
    app,
    close: async () => {
      await Promise.all([owner.$disconnect(), app.$disconnect()]);
    },
  };
}

let seq = 0;

function nextSeq(): number {
  seq += 1;

  return seq;
}

/** Tenant com CNPJ único (como dono, sem RLS). */
export async function seedTenant(owner: PrismaClient): Promise<string> {
  const n = nextSeq();
  const cnpj = `${String(Date.now() % 1e9).padStart(9, "0")}${String(n).padStart(5, "0")}`;
  const tenant = await owner.tenant.create({
    data: {
      razaoSocial: `Empresa ${n}`,
      nomeFantasia: `E${n}`,
      cnpj,
      ie: "123",
      logradouro: "Rua A",
      bairro: "Centro",
      codigoMunicipio: "3550308",
      municipio: "São Paulo",
      uf: "SP",
      cep: "01001000",
      ambiente: "HOMOLOGACAO",
    },
  });

  return tenant.id;
}

export async function seedProduct(owner: PrismaClient, tenantId: string) {
  const sku = `SKU-${randomUUID().slice(0, 8)}`;

  return owner.product.create({
    data: {
      tenantId,
      sku,
      nome: `Produto ${sku}`,
      ncm: "61091000",
      origem: 0,
      unidade: "UN",
      preco: 10,
      precoCusto: 5,
    },
  });
}

export async function seedPedido(owner: PrismaClient, tenantId: string, productIds: string[]) {
  return owner.pedido.create({
    data: {
      tenantId,
      marketplace: "MERCADO_LIVRE",
      destCpf: "00000000191",
      destNome: "Consumidor",
      destLogradouro: "Rua C",
      destBairro: "Centro",
      destCodigoMunicipio: "3550308",
      destMunicipio: "São Paulo",
      destUf: "SP",
      destCep: "01001000",
      itens: {
        create: productIds.map((productId, i) => ({ productId, numeroItem: i + 1, quantidade: 1 })),
      },
    },
  });
}

type SeedNfeOptions = {
  productId?: string;
  tipo?: "REMESSA" | "RETORNO_SIMBOLICO" | "VENDA";
  quantidade?: number;
  saldo?: number | null;
  referenciaId?: string;
};

export async function seedNfe(owner: PrismaClient, tenantId: string, opts: SeedNfeOptions = {}) {
  const n = nextSeq();
  const chave = `${Date.now()}${String(n).padStart(6, "0")}`.padEnd(44, "7").slice(0, 44);

  return owner.nFe.create({
    data: {
      tenantId,
      productId: opts.productId,
      chave,
      numero: n,
      serie: 5,
      natOp: "Teste",
      cfop: "5949",
      ncm: "61091000",
      destNome: "CD",
      destDoc: "00000000000191",
      destUf: "SP",
      valor: 100,
      valorIcms: 0,
      aliqIcms: 0,
      status: "AUTORIZADA",
      emitidaEm: new Date(),
      pedidoMl: `PED-${n}`,
      marketplace: "MERCADO_LIVRE",
      tipo: opts.tipo ?? "REMESSA",
      quantidade: opts.quantidade ?? 10,
      saldoDisponivel: opts.saldo === undefined ? null : opts.saldo,
      nfeReferenciaId: opts.referenciaId,
    },
  });
}

export async function seedNfeItem(
  owner: PrismaClient,
  tenantId: string,
  nfeId: string,
  productId: string,
  opts: { quantidade: number; saldo: number | null },
) {
  return owner.nfeItem.create({
    data: {
      tenantId,
      nfeId,
      productId,
      numeroItem: 1,
      quantidade: opts.quantidade,
      valor: 100,
      valorIcms: 0,
      ncm: "61091000",
      cfop: "5949",
      saldoDisponivel: opts.saldo,
    },
  });
}
