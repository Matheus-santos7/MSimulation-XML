import type { ReferenciaFiscal } from "../value-objects/referencia-fiscal.js";
import type { TipoNota } from "../value-objects/tipo-nota.js";

/**
 * Nota fiscal no contexto Remessas — visão de domínio desacoplada do Prisma.
 *
 * Representa NF-e de remessa física, retorno simbólico ou remessa simbólica,
 * com vínculo ascendente (`referencia`) quando a nota não é raiz da cadeia.
 */
export type NotaFiscal = {
  id: string;
  tenantId: string;
  productId: string;
  tipo: TipoNota;
  chave: string;
  numero: number;
  serie: number;
  quantidade: number;
  /** CD de origem logística (avanço); `null` na remessa inicial do seller. */
  unidadeOrigemId: string | null;
  /** CD onde o saldo FIFO fica disponível após a emissão. */
  unidadeDestinoId: string | null;
  /** Ligação filha → nota pai (chave + tipo para validação fiscal). */
  referencia: ReferenciaFiscal | null;
};

/**
 * Rascunho antes da persistência e autorização SEFAZ.
 * `chave` e `numero` podem ser atribuídos pelo emissor fiscal.
 */
export type NotaFiscalRascunho = Omit<NotaFiscal, "id" | "chave" | "numero"> & {
  numero?: number;
  chave?: string;
};

/**
 * Primeira nota da cadeia: envio físico do seller ao CD padrão.
 * Sem referência ascendente — origina saldo FIFO no CD destino.
 */
export function criarRemessaInicial(
  base: Omit<NotaFiscalRascunho, "tipo" | "referencia">,
): NotaFiscalRascunho {
  return {
    ...base,
    tipo: "REMESSA",
    referencia: null,
  };
}

/**
 * Retorno simbólico do avanço entre CDs.
 * Referencia a remessa cuja linha FIFO foi debitada (física ou simbólica anterior).
 */
export function criarRetornoSimbolicoAvanco(
  base: Omit<NotaFiscalRascunho, "tipo" | "referencia">,
  remessaReferencia: Pick<NotaFiscal, "id" | "chave" | "tipo">,
): NotaFiscalRascunho {
  return {
    ...base,
    tipo: "RETORNO_SIMBOLICO",
    referencia: {
      notaPaiId: remessaReferencia.id,
      notaPaiChave: remessaReferencia.chave,
      notaPaiTipo: remessaReferencia.tipo,
    },
  };
}

/**
 * Remessa de avanço entre CDs: mercadoria “chega” ao CD destino sem NF-e física nova.
 * Referencia o retorno simbólico imediatamente anterior e **cria novo saldo FIFO** no destino.
 */
export function criarRemessaAvanco(
  base: Omit<NotaFiscalRascunho, "tipo" | "referencia">,
  retornoReferencia: Pick<NotaFiscal, "id" | "chave" | "tipo">,
): NotaFiscalRascunho {
  return {
    ...base,
    tipo: "REMESSA_AVANCO",
    referencia: {
      notaPaiId: retornoReferencia.id,
      notaPaiChave: retornoReferencia.chave,
      notaPaiTipo: retornoReferencia.tipo,
    },
  };
}

/** @deprecated Use {@link criarRemessaAvanco} */
export const criarRemessaSimbolicaAvanco = criarRemessaAvanco;
