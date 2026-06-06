import type { FastifyHelmetOptions } from "@fastify/helmet";

/**
 * Headers de segurança para API JSON (sem CSP de página HTML).
 * @see https://github.com/fastify/fastify-helmet
 */
export function buildHelmetOptions(): FastifyHelmetOptions {
  return {
    global: true,
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  };
}
