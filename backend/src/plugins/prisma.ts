import fp from "fastify-plugin";
import type { PrismaClient } from "../generated/prisma/client.js";

export type PrismaPluginOptions = {
  /** Client injetado (testes). Sem ele, usa o singleton de `lib/db/prisma.ts`. */
  client?: PrismaClient;
};

export const prismaPlugin = fp<PrismaPluginOptions>(async (fastify, opts) => {
  // Import tardio: o singleton exige DATABASE_URL e não deve ser criado quando há client injetado.
  const client = opts.client ?? (await import("../lib/db/prisma.js")).prisma;

  fastify.decorate("prisma", client);
  fastify.addHook("onClose", async () => {
    await client.$disconnect();
  });
});

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}
