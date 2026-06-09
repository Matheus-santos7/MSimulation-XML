import type { NotaFiscal, NotaFiscalRascunho } from "../entities/nota-fiscal.js";
import type { CamposDestinoNfe } from "../types/destino-nfe.js";
import type { Tenant } from "../../../../generated/prisma/client.js";

export type PersistirNotaInput = NotaFiscalRascunho & {
  numero: number;
  chave: string;
  fiscalPayload: unknown;
  valor: number;
  valorIcms: number;
  aliqIcms: number;
  natOp: string;
  cfop: string;
  ncm: string;
  pedidoMl: string;
  destino: CamposDestinoNfe;
};

/** Porta de saída: persistência de notas fiscais do módulo. */
export interface NotaFiscalRepository {
  buscarPorId(tenantId: string, notaId: string): Promise<NotaFiscal | null>;

  buscarRemessaPrincipal(alocacoes: { remessaNfeId: string }[]): Promise<NotaFiscal | null>;

  persistir(input: PersistirNotaInput): Promise<NotaFiscal>;

  persistirXmlAutorizado(notaId: string, xml: string): Promise<void>;

  persistirXmlFromEmission(input: {
    nfeId: string;
    tenant: Tenant;
    productId: string;
    nfeReferenciaChave?: string;
  }): Promise<void>;
}

export function notaPersistida(
  input: PersistirNotaInput & { id: string },
): NotaFiscal {
  return {
    id: input.id,
    tenantId: input.tenantId,
    productId: input.productId,
    tipo: input.tipo,
    chave: input.chave,
    numero: input.numero,
    serie: input.serie,
    quantidade: input.quantidade,
    unidadeOrigemId: input.unidadeOrigemId,
    unidadeDestinoId: input.unidadeDestinoId,
    referencia: input.referencia,
  };
}
