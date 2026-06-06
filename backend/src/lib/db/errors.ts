import { Prisma } from "../../generated/prisma/client.js";

/** Indisponibilidade do Postgres (daemon parado, rede, credenciais). */
export function isDatabaseUnavailableError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return e.code === "P1001" || e.code === "ECONNREFUSED";
  }
  if (e instanceof Error && e.message.includes("ECONNREFUSED")) {
    return true;
  }
  return false;
}

export const DATABASE_UNAVAILABLE_MESSAGE =
  "Banco de dados indisponível. Verifique se o PostgreSQL está em execução (pnpm docker:up).";
