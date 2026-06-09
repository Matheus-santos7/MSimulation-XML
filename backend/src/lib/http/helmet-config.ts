import type { FastifyHelmetOptions } from "@fastify/helmet";

/**
 * Headers de segurança para API JSON (sem CSP de página HTML).
 * @see https://github.com/fastify/fastify-helmet
 */
export function buildHelmetOptions(): FastifyHelmetOptions {
  const isProd = process.env.NODE_ENV === "production";
  return {
    global: true,
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    ...(isProd
      ? {
          hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
          },
        }
      : {}),
  };
}
