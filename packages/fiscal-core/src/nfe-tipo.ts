/** Tipos de NF-e no domínio fulfillment — espelha Prisma `NFeTipo` sem depender do ORM. */
export const NFeTipo = {
  VENDA: "VENDA",
  REMESSA: "REMESSA",
  RETORNO_SIMBOLICO: "RETORNO_SIMBOLICO",
  DEVOLUCAO: "DEVOLUCAO",
  REMESSA_SIMBOLICA: "REMESSA_SIMBOLICA",
  REMESSA_AVANCO: "REMESSA_AVANCO",
  TRANSFERENCIA_FILIAL: "TRANSFERENCIA_FILIAL",
  RETORNO_FISICO: "RETORNO_FISICO",
  INSULCESSO_DE_ENTREGA: "INSULCESSO_DE_ENTREGA",
} as const;

export type NFeTipoValue = (typeof NFeTipo)[keyof typeof NFeTipo];
