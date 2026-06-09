import type { FastifyCorsOptions } from "@fastify/cors";

const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * CORS restrito por `CORS_ORIGINS` (lista separada por vírgula).
 * Em dev sem env: apenas localhost/127.0.0.1.
 * Em produção sem env: falha no boot (evita `origin: true`).
 */
export function buildCorsOptions(): FastifyCorsOptions {
  const raw = process.env.CORS_ORIGINS?.trim();

  if (raw) {
    const origins = raw.split(",").map((s) => s.trim()).filter(Boolean);
    return {
      origin: origins.length === 1 ? origins[0]! : origins,
      credentials: true,
    };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CORS_ORIGINS é obrigatório em produção (ex.: https://app.seudominio.com).",
    );
  }

  return {
    credentials: true,
    origin(origin, cb) {
      if (!origin || LOCAL_ORIGIN_RE.test(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error("Origin não permitida"), false);
    },
  };
}
