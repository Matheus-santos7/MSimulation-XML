import fp from "fastify-plugin";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { DB_POOL_WARM_CONNECTIONS, warmUpPool } from "../../lib/db/pool-warmup.js";

export type PrismaPluginOptions = {
  /** Client injetado (testes). Sem ele, usa o singleton de `lib/db/prisma.ts`. */
  client?: PrismaClient;
};

export const prismaPlugin = fp<PrismaPluginOptions>(async (fastify, opts) => {
  let client = opts.client;

  if (!client) {
    // Import tardio: o singleton exige DATABASE_URL e não deve ser criado quando há client injetado.
    const db = await import("../../lib/db/prisma.js");
    client = db.prisma;
    // Sem await: a API já atende enquanto as conexões abrem. Falha só perde o aquecimento.
    fastify.addHook("onReady", async () => {
      warmUpPool(db.dbPool, DB_POOL_WARM_CONNECTIONS)
        .then((connected) => fastify.log.info(`Pool do banco aquecido com ${connected} conexões`))
        .catch((error: unknown) => fastify.log.warn({ err: error }, "Falha ao aquecer o pool"));
    });
  }

  const injected = client;
  fastify.decorate("prisma", injected);
  fastify.addHook("onClose", async () => {
    await injected.$disconnect();
  });
});

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}
