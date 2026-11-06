import { Logger } from "@nestjs/common";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { applyDbNetworkDefaults } from "./network.js";
import { appConfig } from "../../config/config.service.js";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  dbPool: pg.Pool | undefined;
};

/**
 * Conexão ociosa fica aberta por 5 min (o Neon suspende o computador após o mesmo tempo): com
 * 30 s, quase toda navegação reabria conexões, ~1 s cada (TCP + TLS + autenticação).
 */
const DB_POOL_IDLE_TIMEOUT_MS = 300_000;

const poolLogger = new Logger("DbPool");

function createDbPool(): pg.Pool {
  const url = appConfig.databaseUrl;
  if (!url) {
    throw new Error("DATABASE_URL não definida (backend/.env)");
  }
  applyDbNetworkDefaults();
  // Lido antes do pool: DB_POOL_MAX inválido derruba o boot em vez de abrir um pool errado.
  const DB_POOL_MAX = appConfig.dbPoolMax;
  // connectionTimeoutMillis dá tempo ao Neon serverless de acordar do sleep (pode levar ~5 s).
  const pool = new pg.Pool({
    connectionString: url,
    connectionTimeoutMillis: 30_000,
    idleTimeoutMillis: DB_POOL_IDLE_TIMEOUT_MS,
    max: DB_POOL_MAX,
  });
  // Sem listener, conexão ociosa derrubada pelo servidor vira exceção não tratada e mata o processo.
  pool.on("error", (error) => poolLogger.warn(`Conexão ociosa do pool encerrada: ${error.message}`));

  return pool;
}

function createPrismaClient(pool: pg.Pool): PrismaClient {
  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter, log: ["error", "warn"] });
}

export const dbPool = globalForPrisma.dbPool ?? createDbPool();
export const prisma = globalForPrisma.prisma ?? createPrismaClient(dbPool);

if (!appConfig.isProduction) {
  globalForPrisma.dbPool = dbPool;
  globalForPrisma.prisma = prisma;
}
