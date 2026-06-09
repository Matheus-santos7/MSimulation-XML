/**
 * Tipos de nota do bounded context Remessas.
 * Espelha NFeTipo do Prisma, mas isolado do ORM no domínio.
 */
export const TipoNota = {
  REMESSA: "REMESSA",
  RETORNO_SIMBOLICO: "RETORNO_SIMBOLICO",
  REMESSA_SIMBOLICA: "REMESSA_SIMBOLICA",
} as const;

export type TipoNota = (typeof TipoNota)[keyof typeof TipoNota];

/** Cadeia fiscal válida para avanço de mercadoria entre CDs. */
export const CADEIA_AVANCO_MERCADORIA: readonly TipoNota[] = [
  TipoNota.REMESSA,
  TipoNota.RETORNO_SIMBOLICO,
  TipoNota.REMESSA_SIMBOLICA,
] as const;

export function isTipoNota(value: string): value is TipoNota {
  return (Object.values(TipoNota) as string[]).includes(value);
}
