import type { NotaFiscal, NotaFiscalRascunho } from "../entities/nota-fiscal.js";
import type { CamposDestinoNfe } from "../types/destino-nfe.js";
import type { Tenant } from "../../../../generated/prisma/client.js";

/**
 * Dados necessários para gravar NF-e após preparação fiscal.
 * Estende o rascunho de domínio com campos obrigatórios do Prisma/SEFAZ.
 */
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

/**
 * Port de persistência de notas fiscais do módulo Remessas.
 *
 * Abstrai `nfes`, XML autorizado e vínculos usados na cadeia fiscal e no FIFO
 * (busca da remessa principal debitada no avanço).
 */
export interface NotaFiscalRepository {
  /** Busca nota por ID no tenant. */
  buscarPorId(tenantId: string, notaId: string): Promise<NotaFiscal | null>;

  /**
   * Obtém a NF-e de remessa referenciada pelas alocações FIFO.
   * Usada para amarrar retorno simbólico à nota debitada.
   */
  buscarRemessaPrincipal(alocacoes: { remessaNfeId: string }[]): Promise<NotaFiscal | null>;

  /** Grava NF-e e retorna entidade de domínio com `id` gerado. */
  persistir(input: PersistirNotaInput): Promise<NotaFiscal>;

  /** Armazena XML autorizado após resposta SEFAZ. */
  persistirXmlAutorizado(notaId: string, xml: string): Promise<void>;

  /**
   * Emite e persiste XML via pipeline fiscal legado (simulador).
   * @param input.nfeReferenciaChave - Chave da nota pai para referência NFRef
   */
  persistirXmlFromEmission(input: {
    nfeId: string;
    tenant: Tenant;
    productId: string;
    nfeReferenciaChave?: string;
  }): Promise<void>;
}

/** Mapper: input persistido + id → {@link NotaFiscal}. */
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
