import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { Redis } from "ioredis";
import {
  createRateLimitHandler,
  registerRootRateLimit,
  strictRouteRateLimit,
} from "../rate-limit.js";

// Redis descartável (CI ou `docker run -p 127.0.0.1:56379:6379 redis:7`); sem a variável, pula.
const redisUrl = process.env.INTEGRATION_TEST_REDIS_URL;

const LOGIN_MAX = 3;

async function buildInstance(url: string): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await registerRootRateLimit(app, url);
  const login = createRateLimitHandler(app, strictRouteRateLimit(LOGIN_MAX, "1 minute"), "login");
  const lookup = createRateLimitHandler(app, strictRouteRateLimit(LOGIN_MAX, "1 minute"), "lookup");
  app.get("/login", { preHandler: login }, () => ({ ok: true }));
  app.get("/lookup", { preHandler: lookup }, () => ({ ok: true }));

  return app;
}

describe.skipIf(!redisUrl)("registerRootRateLimit com Redis (P-6)", () => {
  let first: FastifyInstance;
  let second: FastifyInstance;

  beforeAll(async () => {
    const redis = new Redis(redisUrl!);
    const keys = await redis.keys("msx:rate-limit:*");
    if (keys.length > 0) await redis.del(...keys);
    await redis.quit();

    first = await buildInstance(redisUrl!);
    second = await buildInstance(redisUrl!);
  });

  afterAll(async () => {
    await first.close();
    await second.close();
  });

  it("should share the per-IP count across API instances", async () => {
    const hit = (app: FastifyInstance) =>
      app.inject({ url: "/login", remoteAddress: "203.0.113.10" });

    const statuses = [
      (await hit(first)).statusCode,
      (await hit(second)).statusCode,
      (await hit(first)).statusCode,
      (await hit(second)).statusCode,
    ];

    expect(statuses).toEqual([200, 200, 200, 403]);
  });

  it("should keep each limiter's count separate for the same IP", async () => {
    const res = await first.inject({ url: "/lookup", remoteAddress: "203.0.113.10" });

    expect(res.statusCode).toBe(200);
  });

  it("should let requests through when Redis is unreachable", async () => {
    const offline = await buildInstance("redis://127.0.0.1:1");
    const res = await offline.inject({ url: "/login", remoteAddress: "203.0.113.11" });
    await offline.close();

    expect(res.statusCode).toBe(200);
  });
});
