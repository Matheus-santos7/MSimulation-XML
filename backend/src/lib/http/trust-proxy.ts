/** Valor aceito pelo `trustProxy` do Fastify: tudo, nº de saltos ou lista de IPs/CIDRs. */
export type TrustProxySetting = boolean | number | string;

/** Saltos confiáveis em produção sem `TRUST_PROXY`: o proxy/load balancer da infra na frente da API. */
const PRODUCTION_DEFAULT_HOPS = 1;

/**
 * `TRUST_PROXY` → `trustProxy` do Fastify (S-3). Aceita `true`/`false`, número de saltos
 * (`1`: só o proxy da infra; `2`: proxy + frontend em outro host, como Vercel → Render) ou lista
 * de IPs/CIDRs separada por vírgula. Sem valor: 1 salto em produção, nada fora dela.
 *
 * `true` confia em todo o `X-Forwarded-For`, que o cliente escolhe: o rate limit por IP deixa de
 * valer. Só use atrás de um proxy que sobrescreve o header.
 */
export function resolveTrustProxy(
  value: string | undefined,
  isProduction: boolean,
): TrustProxySetting {
  const setting = value?.trim();
  if (!setting) return isProduction ? PRODUCTION_DEFAULT_HOPS : false;
  if (setting === "true") return true;
  if (setting === "false") return false;
  if (/^\d+$/.test(setting)) return Number(setting);

  return setting;
}
