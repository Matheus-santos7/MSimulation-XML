import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NFeTipo } from "../generated/prisma/client.js";
import {
  consumirSaldoRemessaFifo,
  debitarSaldoRemessaPorCd,
  estornarConsumosRemessa,
  SaldoRemessaInsuficienteError,
} from "./remessa-fifo.js";

type RemessaRow = {
  id: string;
  tenantId: string;
  productId: string;
  tipo: NFeTipo;
  saldoDisponivel: number;
  emitidaEm: Date;
  numero: number;
  deletedAt: Date | null;
  unidadeDestinoId: string | null;
};

type ConsumoRow = {
  retornoNfeId: string;
  remessaNfeId: string;
  quantidade: number;
};

function createFifoMock(initial: RemessaRow[]) {
  const nfes = new Map(initial.map((r) => [r.id, { ...r }]));
  const consumos: ConsumoRow[] = [];

  const tx = {
    nFe: {
      findMany: async ({
        where,
        orderBy,
      }: {
        where: {
          tenantId: string;
          productId: string;
          tipo: NFeTipo;
          saldoDisponivel?: { gt: number };
          deletedAt: null;
          unidadeDestinoId?: string;
        };
        orderBy: [{ emitidaEm: "asc" | "desc" }, { numero: "asc" | "desc" }];
      }) => {
        let rows = [...nfes.values()].filter(
          (r) =>
            r.tenantId === where.tenantId &&
            r.productId === where.productId &&
            r.tipo === where.tipo &&
            r.deletedAt === null &&
            (where.saldoDisponivel?.gt !== undefined
              ? (r.saldoDisponivel ?? 0) > where.saldoDisponivel.gt
              : true) &&
            (where.unidadeDestinoId === undefined ||
              r.unidadeDestinoId === where.unidadeDestinoId),
        );
        const emitOrder = orderBy[0]?.emitidaEm === "desc" ? -1 : 1;
        const numOrder = orderBy[1]?.numero === "desc" ? -1 : 1;
        rows.sort((a, b) => {
          const da = a.emitidaEm.getTime() - b.emitidaEm.getTime();
          if (da !== 0) return da * emitOrder;
          return (a.numero - b.numero) * numOrder;
        });
        return rows;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { saldoDisponivel?: number | { increment: number } };
      }) => {
        const row = nfes.get(where.id);
        assert.ok(row, "NFe mock não encontrada");
        const saldoPatch = data.saldoDisponivel;
        if (typeof saldoPatch === "number") {
          row.saldoDisponivel = saldoPatch;
        } else if (saldoPatch && typeof saldoPatch === "object" && "increment" in saldoPatch) {
          row.saldoDisponivel = (row.saldoDisponivel ?? 0) + saldoPatch.increment;
        }
      },
    },
    nfeRemessaConsumo: {
      create: async ({ data }: { data: ConsumoRow }) => {
        consumos.push({ ...data });
      },
      findMany: async ({ where }: { where: { retornoNfeId: string } }) =>
        consumos.filter((c) => c.retornoNfeId === where.retornoNfeId),
    },
  };

  return { tx, nfes, consumos };
}

const tenantId = "tenant-1";
const productId = "prod-1";

function remessa(
  id: string,
  saldo: number,
  emitidaEm: string,
  numero: number,
  unidadeDestinoId: string | null = null,
): RemessaRow {
  return {
    id,
    tenantId,
    productId,
    tipo: NFeTipo.REMESSA,
    saldoDisponivel: saldo,
    emitidaEm: new Date(emitidaEm),
    numero,
    deletedAt: null,
    unidadeDestinoId,
  };
}

describe("remessa-fifo", () => {
  it("consome remessa mais antiga primeiro (FIFO)", async () => {
    const { tx, nfes } = createFifoMock([
      remessa("r-novo", 10, "2026-03-02", 20),
      remessa("r-antigo", 10, "2026-01-01", 10),
    ]);

    const alocacoes = await consumirSaldoRemessaFifo(
      tx,
      tenantId,
      productId,
      3,
      "retorno-1",
    );

    assert.equal(alocacoes.length, 1);
    assert.equal(alocacoes[0]!.remessaNfeId, "r-antigo");
    assert.equal(alocacoes[0]!.quantidade, 3);
    assert.equal(nfes.get("r-antigo")!.saldoDisponivel, 7);
    assert.equal(nfes.get("r-novo")!.saldoDisponivel, 10);
  });

  it("divide quantidade entre várias remessas na ordem FIFO", async () => {
    const { tx } = createFifoMock([
      remessa("r1", 2, "2026-01-01", 1),
      remessa("r2", 5, "2026-02-01", 2),
    ]);

    const alocacoes = await consumirSaldoRemessaFifo(tx, tenantId, productId, 4, "ret-1");

    assert.deepEqual(alocacoes, [
      { remessaNfeId: "r1", quantidade: 2 },
      { remessaNfeId: "r2", quantidade: 2 },
    ]);
  });

  it("lança SaldoRemessaInsuficienteError quando saldo total é menor", async () => {
    const { tx } = createFifoMock([remessa("r1", 1, "2026-01-01", 1)]);

    await assert.rejects(
      () => consumirSaldoRemessaFifo(tx, tenantId, productId, 5, "ret-1"),
      (err: unknown) => {
        assert.ok(err instanceof SaldoRemessaInsuficienteError);
        assert.equal(err.productId, productId);
        assert.equal(err.solicitado, 5);
        assert.equal(err.disponivel, 1);
        return true;
      },
    );
  });

  it("estornarConsumosRemessa devolve saldo nas remessas originais", async () => {
    const { tx, nfes } = createFifoMock([remessa("r1", 10, "2026-01-01", 1)]);

    await consumirSaldoRemessaFifo(tx, tenantId, productId, 4, "retorno-x");
    assert.equal(nfes.get("r1")!.saldoDisponivel, 6);

    const estornos = await estornarConsumosRemessa(tx, "retorno-x");
    assert.deepEqual(estornos, [{ remessaNfeId: "r1", quantidade: 4 }]);
    assert.equal(nfes.get("r1")!.saldoDisponivel, 10);
  });

  it("debitarSaldoRemessaPorCd filtra por unidade de destino", async () => {
    const { tx, nfes } = createFifoMock([
      remessa("cd-a", 5, "2026-01-01", 1, "unidade-a"),
      remessa("cd-b", 8, "2026-01-02", 2, "unidade-b"),
    ]);

    await debitarSaldoRemessaPorCd(tx, tenantId, productId, 3, "unidade-b");

    assert.equal(nfes.get("cd-a")!.saldoDisponivel, 5);
    assert.equal(nfes.get("cd-b")!.saldoDisponivel, 5);
  });

  it("ignora remessas com saldo zero", async () => {
    const { tx } = createFifoMock([
      remessa("vazia", 0, "2026-01-01", 1),
      remessa("ok", 4, "2026-01-02", 2),
    ]);

    const alocacoes = await consumirSaldoRemessaFifo(tx, tenantId, productId, 2, "ret-1");
    assert.deepEqual(alocacoes, [{ remessaNfeId: "ok", quantidade: 2 }]);
  });
});
