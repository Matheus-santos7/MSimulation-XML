import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { applyDbNetworkDefaults } from "./network.js";
import { appConfig } from "../../config/config.service.js";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
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
    idleTimeoutMillis: 30_000,
    max: DB_POOL_MAX,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter, log: ["error", "warn"] });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (!appConfig.isProduction) {
  globalForPrisma.prisma = prisma;
}
