import type { FastifyPluginAsync } from "fastify";
import { ZodError } from "zod";
import { lookupRateLimitPlugin, lookupRouteRateLimit } from "../../lib/lookup-rate-limit.js";
import { cepParamSchema, cnpjParamSchema } from "../../schemas/lookup/lookup.js";
import {
  LookupNotFoundError,
  LookupValidationError,
  lookupCep,
  lookupCnpj,
} from "../../services/lookup/lookup-service.js";

export const lookupRoutes: FastifyPluginAsync = async (app) => {
  await app.register(lookupRateLimitPlugin);

  app.get("/lookup/cnpj/:cnpj", {
    config: { rateLimit: lookupRouteRateLimit },
  }, async (req, reply) => {
    try {
      const { cnpj } = cnpjParamSchema.parse(req.params);
      return await lookupCnpj(cnpj);
    } catch (e) {
      if (e instanceof LookupNotFoundError) return reply.status(404).send({ error: e.message });
      if (e instanceof LookupValidationError) return reply.status(400).send({ error: e.message });
      if (e instanceof ZodError) return reply.status(400).send({ error: "CNPJ inválido" });
      app.log.error(e);
      const msg = e instanceof Error ? e.message : "Falha ao consultar CNPJ";
      return reply.status(502).send({ error: msg });
    }
  });

  app.get("/lookup/cep/:cep", {
    config: { rateLimit: lookupRouteRateLimit },
  }, async (req, reply) => {
    try {
      const { cep } = cepParamSchema.parse(req.params);
      return await lookupCep(cep);
    } catch (e) {
      if (e instanceof LookupNotFoundError) return reply.status(404).send({ error: e.message });
      if (e instanceof LookupValidationError) return reply.status(400).send({ error: e.message });
      if (e instanceof ZodError) return reply.status(400).send({ error: "CEP inválido" });
      app.log.error(e);
      const msg = e instanceof Error ? e.message : "Falha ao consultar CEP";
      return reply.status(502).send({ error: msg });
    }
  });
};
