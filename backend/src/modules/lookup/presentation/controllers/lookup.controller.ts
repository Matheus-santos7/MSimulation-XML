import type { FastifyPluginAsync } from "fastify";
import { ZodError } from "zod";
import { lookupRateLimitPlugin, lookupRouteRateLimit } from "../../infrastructure/http/lookup-rate-limit.js";
import { LookupNotFoundError } from "../../domain/errors/lookup-not-found.error.js";
import { LookupValidationError } from "../../domain/errors/lookup-validation.error.js";
import { createLookupModule } from "../../infrastructure/factory/lookup-module.factory.js";
import { cepParamSchema, cnpjParamSchema } from "../schemas/lookup.schemas.js";

export const lookupController: FastifyPluginAsync = async (app) => {
  const lookup = createLookupModule();

  await app.register(lookupRateLimitPlugin);

  app.get(
    "/lookup/cnpj/:cnpj",
    {
      config: { rateLimit: lookupRouteRateLimit },
    },
    async (req, reply) => {
      try {
        const { cnpj } = cnpjParamSchema.parse(req.params);
        return await lookup.lookupCnpj.execute(cnpj);
      } catch (error) {
        if (error instanceof LookupNotFoundError) {
          return reply.status(404).send({ error: error.message });
        }
        if (error instanceof LookupValidationError) {
          return reply.status(400).send({ error: error.message });
        }
        if (error instanceof ZodError) {
          return reply.status(400).send({ error: "CNPJ inválido" });
        }
        app.log.error(error);
        const message = error instanceof Error ? error.message : "Falha ao consultar CNPJ";
        return reply.status(502).send({ error: message });
      }
    },
  );

  app.get(
    "/lookup/cep/:cep",
    {
      config: { rateLimit: lookupRouteRateLimit },
    },
    async (req, reply) => {
      try {
        const { cep } = cepParamSchema.parse(req.params);
        return await lookup.lookupCep.execute(cep);
      } catch (error) {
        if (error instanceof LookupNotFoundError) {
          return reply.status(404).send({ error: error.message });
        }
        if (error instanceof LookupValidationError) {
          return reply.status(400).send({ error: error.message });
        }
        if (error instanceof ZodError) {
          return reply.status(400).send({ error: "CEP inválido" });
        }
        app.log.error(error);
        const message = error instanceof Error ? error.message : "Falha ao consultar CEP";
        return reply.status(502).send({ error: message });
      }
    },
  );
};

/** @deprecated Use lookupController */
export const lookupRoutes = lookupController;
