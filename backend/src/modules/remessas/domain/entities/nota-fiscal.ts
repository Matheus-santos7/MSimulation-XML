import type { ReferenciaFiscal } from "../value-objects/referencia-fiscal.js";
import type { TipoNota } from "../value-objects/tipo-nota.js";

/** Entidade de domínio: nota fiscal do contexto Remessas (leitura/criação). */
export type NotaFiscal = {
  id: string;
  tenantId: string;
  productId: string;
  tipo: TipoNota;
  chave: string;
  numero: number;
  serie: number;
  quantidade: number;
  unidadeOrigemId: string | null;
  unidadeDestinoId: string | null;
  referencia: ReferenciaFiscal | null;
};

export type NotaFiscalRascunho = Omit<NotaFiscal, "id" | "chave" | "numero"> & {
  numero?: number;
  chave?: string;
};

/** Remessa inicial: primeira nota, sem referência ascendente. */
export function criarRemessaInicial(
  base: Omit<NotaFiscalRascunho, "tipo" | "referencia">,
): NotaFiscalRascunho {
  return {
    ...base,
    tipo: "REMESSA",
    referencia: null,
  };
}

/** Retorno simbólico do avanço: referencia a remessa inicial (ou remessa FIFO debitada). */
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

/** Remessa simbólica do avanço: referencia o retorno simbólico imediatamente anterior. */
export function criarRemessaSimbolicaAvanco(
  base: Omit<NotaFiscalRascunho, "tipo" | "referencia">,
  retornoReferencia: Pick<NotaFiscal, "id" | "chave" | "tipo">,
): NotaFiscalRascunho {
  return {
    ...base,
    tipo: "REMESSA_SIMBOLICA",
    referencia: {
      notaPaiId: retornoReferencia.id,
      notaPaiChave: retornoReferencia.chave,
      notaPaiTipo: retornoReferencia.tipo,
    },
  };
}
