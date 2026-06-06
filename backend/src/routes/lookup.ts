import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { lookupRateLimitPlugin, lookupRouteRateLimit } from "../lib/lookup-rate-limit.js";
import {
  LookupNotFoundError,
  LookupValidationError,
  lookupCep,
  lookupCnpj,
} from "../services/lookup-service.js";

const cnpjParam = z.object({
  cnpj: z.string().min(14).max(18),
});

const cepParam = z.object({
  cep: z.string().min(8).max(9),
});

export const lookupRoutes: FastifyPluginAsync = async (app) => {
  await app.register(lookupRateLimitPlugin);

  app.get("/lookup/cnpj/:cnpj", {
    config: { rateLimit: lookupRouteRateLimit },
  }, async (req, reply) => {
    try {
      const { cnpj } = cnpjParam.parse(req.params);
      return await lookupCnpj(cnpj);
    } catch (e) {
      if (e instanceof LookupNotFoundError) return reply.status(404).send({ error: e.message });
      if (e instanceof LookupValidationError) return reply.status(400).send({ error: e.message });
      if (e instanceof z.ZodError) return reply.status(400).send({ error: "CNPJ inválido" });
      app.log.error(e);
      const msg = e instanceof Error ? e.message : "Falha ao consultar CNPJ";
      return reply.status(502).send({ error: msg });
    }
  });

  app.get("/lookup/cep/:cep", {
    config: { rateLimit: lookupRouteRateLimit },
  }, async (req, reply) => {
    try {
      const { cep } = cepParam.parse(req.params);
      return await lookupCep(cep);
    } catch (e) {
      if (e instanceof LookupNotFoundError) return reply.status(404).send({ error: e.message });
      if (e instanceof LookupValidationError) return reply.status(400).send({ error: e.message });
      if (e instanceof z.ZodError) return reply.status(400).send({ error: "CEP inválido" });
      app.log.error(e);
      const msg = e instanceof Error ? e.message : "Falha ao consultar CEP";
      return reply.status(502).send({ error: msg });
    }
  });
};
