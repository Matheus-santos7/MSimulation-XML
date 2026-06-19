import { NFeTipo } from "../../../../generated/prisma/client.js";

/** Linha FIFO mínima para ordenação na venda ao consumidor final. */
export type FifoVendaItem = {
  id: string;
  nfeId: string;
  saldoDisponivel: number | null;
  nfeTipo?: NFeTipo;
  destUf?: string;
  unidadeUf?: string;
  unidadeDestinoId?: string | null;
  unidadeCodigo?: string | null;
};

/** CD padrão do tenant (`tenant_unidade_logistica.padrao = true`). */
export type DefaultCdContext = {
  unitId: string | null;
  codigo: string | null;
};

function resolveItemUf(item: FifoVendaItem): string {
  return (item.unidadeUf ?? item.destUf ?? "").trim().toUpperCase();
}

function matchesDefaultCd(item: FifoVendaItem, defaultCd: DefaultCdContext): boolean {
  if (!defaultCd.unitId && !defaultCd.codigo) return false;
  if (defaultCd.unitId && item.unidadeDestinoId === defaultCd.unitId) return true;
  const codigo = item.unidadeCodigo?.trim().toUpperCase();
  const codigoPadrao = defaultCd.codigo?.trim().toUpperCase();
  return Boolean(codigo && codigoPadrao && codigo === codigoPadrao);
}

/**
 * Prioridade de consumo FIFO na venda (menor = consome antes):
 *
 * 0 — saldo no CD/UF do comprador (remessa física ou avanço simbólico)
 * 1 — remessa avanço em outra UF
 * 2 — remessa física no CD padrão do tenant
 * 3 — demais remessas físicas com saldo (fallback FIFO)
 */
export function rankFifoItemForVenda(
  item: FifoVendaItem,
  buyerUf: string,
  defaultCd: DefaultCdContext,
): number {
  const ufComprador = buyerUf.trim().toUpperCase();
  const ufItem = resolveItemUf(item);

  if (ufComprador && ufItem === ufComprador) return 0;
  if (item.nfeTipo === NFeTipo.REMESSA_AVANCO) return 1;
  if (item.nfeTipo === NFeTipo.REMESSA && matchesDefaultCd(item, defaultCd)) return 2;
  return 3;
}

/**
 * Ordena linhas FIFO para venda preservando FIFO intra-tier (ordem original = `emitidaEm` asc).
 */
export function ordenarFifoParaVenda<T extends FifoVendaItem>(
  itens: T[],
  buyerUf: string,
  defaultCd: DefaultCdContext,
): T[] {
  const indexed = itens.map((item, index) => ({ item, index }));
  indexed.sort((a, b) => {
    const rankA = rankFifoItemForVenda(a.item, buyerUf, defaultCd);
    const rankB = rankFifoItemForVenda(b.item, buyerUf, defaultCd);
    if (rankA !== rankB) return rankA - rankB;
    return a.index - b.index;
  });
  return indexed.map(({ item }) => item);
}
