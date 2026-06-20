import { SaldoRemessaInsuficienteError } from "./remessa-fifo.errors.js";
import { listRemessaBalanceByCd } from "./remessa-fifo-balance-query.js";
import type { RemessaFifoPrisma } from "./remessa-fifo.types.js";

/**
 * ID gravado nas NF-es de remessa (`unidade_destino_id`) para debitar FIFO no CD origem.
 * Se o catálogo de CDs foi reimportado, o UUID do dropdown pode divergir do das notas antigas;
 * nesse caso casa pelo código (ex.: SP02).
 */
/**
 * CD ativo do catálogo para metadados fiscais do avanço.
 * O saldo FIFO pode estar em NF-es com `unidade_destino_id` legado/inativo.
 */
export async function resolveAdvanceFiscalOrigin(
  db: RemessaFifoPrisma,
  tenantId: string,
  productId: string,
  unidadeOrigemId: string,
  productSku: string | undefined,
  obterAtiva: (id: string) => Promise<{ id: string; codigo: string; uf: string; nome: string } | null>,
  obterAtivaPorCodigo: (codigo: string) => Promise<{ id: string; codigo: string; uf: string; nome: string } | null>,
): Promise<{ origem: { id: string; codigo: string; uf: string; nome: string }; fifoOrigemId: string } | null> {
  const saldos = await listRemessaBalanceByCd(db, tenantId, productId, productSku);

  const direta = await obterAtiva(unidadeOrigemId);
  const codigoDireto = direta?.codigo;
  let fifoOrigemId: string;
  try {
    fifoOrigemId = await resolveFifoOriginUnitId(
      db,
      tenantId,
      productId,
      unidadeOrigemId,
      codigoDireto ??
        saldos.find(
          (s) =>
            s.unidadeDestinoId === unidadeOrigemId ||
            s.fifoUnidadeDestinoId === unidadeOrigemId,
        )?.unidade?.codigo ??
        "",
      productSku,
    );
  } catch (e) {
    if (e instanceof SaldoRemessaInsuficienteError) return null;
    throw e;
  }

  if (direta) {
    return { origem: direta, fifoOrigemId };
  }

  const saldoRow = saldos.find(
    (s) => s.fifoUnidadeDestinoId === fifoOrigemId || s.unidadeDestinoId === fifoOrigemId,
  );
  const codigoSaldo = saldoRow?.unidade?.codigo?.trim();
  if (codigoSaldo) {
    const porCodigo = await obterAtivaPorCodigo(codigoSaldo);
    if (porCodigo) {
      return { origem: porCodigo, fifoOrigemId };
    }
  }

  return null;
}

export async function resolveFifoOriginUnitId(
  db: RemessaFifoPrisma,
  tenantId: string,
  productId: string,
  unidadeOrigemId: string,
  unidadeOrigemCodigo: string,
  productSku?: string,
): Promise<string> {
  const saldos = await listRemessaBalanceByCd(db, tenantId, productId, productSku);
  const direct = saldos.find((s) => s.unidadeDestinoId === unidadeOrigemId && s.saldo > 0);
  if (direct) return direct.fifoUnidadeDestinoId;

  const fifoDirect = saldos.find(
    (s) => s.fifoUnidadeDestinoId === unidadeOrigemId && s.saldo > 0,
  );
  if (fifoDirect) return fifoDirect.fifoUnidadeDestinoId;

  const codigo = unidadeOrigemCodigo.trim().toUpperCase();
  const byCodigo = saldos.find(
    (s) => s.unidade?.codigo?.trim().toUpperCase() === codigo && s.saldo > 0,
  );
  if (byCodigo) return byCodigo.fifoUnidadeDestinoId;

  const total = saldos.reduce((acc, s) => acc + s.saldo, 0);
  if (total <= 0) return unidadeOrigemId;

  throw new SaldoRemessaInsuficienteError(
    productId,
    1,
    saldos.find((s) => s.unidadeDestinoId === unidadeOrigemId)?.saldo ?? 0,
  );
}
