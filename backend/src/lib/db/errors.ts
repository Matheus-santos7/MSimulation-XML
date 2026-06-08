import { Prisma } from "../../generated/prisma/client.js";

/** Indisponibilidade do Postgres (daemon parado, rede, credenciais). */
export function isDatabaseUnavailableError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return e.code === "P1001" || e.code === "P1000" || e.code === "ECONNREFUSED";
  }
  if (e instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  if (e instanceof Error && /ECONNREFUSED|Can't reach database|P1001/i.test(e.message)) {
    return true;
  }
  return false;
}

export const DATABASE_UNAVAILABLE_MESSAGE =
  "Banco de dados indisponível";
