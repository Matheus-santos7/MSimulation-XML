import type { FastifyHelmetOptions } from "@fastify/helmet";
import { appConfig } from "../../config/config.service.js";

/**
 * Headers de segurança para API JSON (sem CSP de página HTML).
 * @see https://github.com/fastify/fastify-helmet
 */
export function buildHelmetOptions(): FastifyHelmetOptions {
  const isProd = appConfig.isProduction;
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
