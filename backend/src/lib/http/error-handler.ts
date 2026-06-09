import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client.js";
import { DATABASE_UNAVAILABLE_MESSAGE, isDatabaseUnavailableError } from "../db/errors.js";
import { sendZodValidationError } from "./domain-errors.js";

const GENERIC_INTERNAL_ERROR = "Erro interno do servidor";

export function registerGlobalErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, _req: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof ZodError) {
      return sendZodValidationError(reply, error);
    }

    if (isDatabaseUnavailableError(error)) {
      return reply.status(503).send({ error: DATABASE_UNAVAILABLE_MESSAGE });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      app.log.error({ err: error, code: error.code }, "Erro Prisma");
      if (error.code === "P2002") {
        return reply.status(409).send({ error: "Registro duplicado" });
      }
      if (error.code === "P2025") {
        return reply.status(404).send({ error: "Registro não encontrado" });
      }
      return reply.status(500).send({ error: GENERIC_INTERNAL_ERROR });
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      app.log.error({ err: error }, "Validação Prisma");
      return reply.status(400).send({ error: "Dados inválidos" });
    }

    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      app.log.error({ err: error }, "Erro não tratado");
      return reply.status(500).send({ error: GENERIC_INTERNAL_ERROR });
    }

    return reply.status(statusCode).send({
      error: error.message || GENERIC_INTERNAL_ERROR,
    });
  });
}
