import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NFeTipo } from "../../../generated/prisma/client.js";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import {
  consumirSaldoRemessaFifo,
  debitarSaldoRemessaPorCd,
  estornarConsumosRemessa,
  listarSaldoRemessaPorCd,
  realignRemessaFifoProductIdsBySku,
  SaldoRemessaInsuficienteError,
} from "./remessa-fifo.js";

type ItemRow = {
  id: string;
  tenantId: string;
  nfeId: string;
  productId: string;
  numeroItem: number;
  saldoDisponivel: number;
  nfe: {
    tenantId: string;
    tipo: NFeTipo;
    emitidaEm: Date;
    numero: number;
    deletedAt: null;
    unidadeDestinoId: string | null;
  };
};

type ConsumoRow = {
  retornoNfeId: string;
  remessaNfeId: string;
  nfeItemId: string;
  quantidade: number;
};

function createFifoMock(initial: ItemRow[]) {
  const items = new Map(initial.map((r) => [r.id, structuredClone(r)]));
  const consumos: ConsumoRow[] = [];

  const tx = {
    nfeItem: {
      findMany: async ({
        where,
        orderBy,
      }: {
        where: {
          tenantId: string;
          productId: string;
          saldoDisponivel?: { gt: number };
          nfe: {
            tenantId: string;
            tipo: NFeTipo;
            deletedAt: null;
            unidadeDestinoId?: string;
          };
        };
        orderBy: [
          { nfe: { emitidaEm: "asc" | "desc" } },
          { nfe: { numero: "asc" | "desc" } },
          { numeroItem: "asc" | "desc" },
        ];
      }) => {
        let rows = [...items.values()].filter(
          (r) =>
            r.tenantId === where.tenantId &&
            r.productId === where.productId &&
            r.nfe.tenantId === where.nfe.tenantId &&
            r.nfe.tipo === where.nfe.tipo &&
            r.nfe.deletedAt === null &&
            (where.saldoDisponivel?.gt !== undefined
              ? (r.saldoDisponivel ?? 0) > where.saldoDisponivel.gt
              : true) &&
            (where.nfe.unidadeDestinoId === undefined ||
              r.nfe.unidadeDestinoId === where.nfe.unidadeDestinoId),
        );
        const emitOrder = orderBy[0]?.nfe.emitidaEm === "desc" ? -1 : 1;
        const numOrder = orderBy[1]?.nfe.numero === "desc" ? -1 : 1;
        const itemOrder = orderBy[2]?.numeroItem === "desc" ? -1 : 1;
        rows.sort((a, b) => {
          const da = a.nfe.emitidaEm.getTime() - b.nfe.emitidaEm.getTime();
          if (da !== 0) return da * emitOrder;
          const dn = a.nfe.numero - b.nfe.numero;
          if (dn !== 0) return dn * numOrder;
          return (a.numeroItem - b.numeroItem) * itemOrder;
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
        const row = items.get(where.id);
        assert.ok(row, "NfeItem mock não encontrado");
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

  return { tx, items, consumos };
}

const tenantId = "tenant-1";
const productId = "prod-1";

function item(
  id: string,
  nfeId: string,
  saldo: number,
  emitidaEm: string,
  numero: number,
  unidadeDestinoId: string | null = null,
  numeroItem = 1,
): ItemRow {
  return {
    id,
    tenantId,
    nfeId,
    productId,
    numeroItem,
    saldoDisponivel: saldo,
    nfe: {
      tenantId,
      tipo: NFeTipo.REMESSA,
      emitidaEm: new Date(emitidaEm),
      numero,
      deletedAt: null,
      unidadeDestinoId,
    },
  };
}

describe("remessa-fifo", () => {
  it("consome remessa mais antiga primeiro (FIFO)", async () => {
    const { tx, items } = createFifoMock([
      item("i-novo", "r-novo", 10, "2026-03-02", 20),
      item("i-antigo", "r-antigo", 10, "2026-01-01", 10),
    ]);

    const alocacoes = await consumirSaldoRemessaFifo(tx, tenantId, productId, 3, "retorno-1");

    assert.equal(alocacoes.length, 1);
    assert.equal(alocacoes[0]!.remessaNfeId, "r-antigo");
    assert.equal(alocacoes[0]!.nfeItemId, "i-antigo");
    assert.equal(alocacoes[0]!.quantidade, 3);
    assert.equal(items.get("i-antigo")!.saldoDisponivel, 7);
    assert.equal(items.get("i-novo")!.saldoDisponivel, 10);
  });

  it("divide quantidade entre várias remessas na ordem FIFO", async () => {
    const { tx } = createFifoMock([
      item("i1", "r1", 2, "2026-01-01", 1),
      item("i2", "r2", 5, "2026-02-01", 2),
    ]);

    const alocacoes = await consumirSaldoRemessaFifo(tx, tenantId, productId, 4, "ret-1");

    assert.deepEqual(alocacoes, [
      { remessaNfeId: "r1", nfeItemId: "i1", quantidade: 2 },
      { remessaNfeId: "r2", nfeItemId: "i2", quantidade: 2 },
    ]);
  });

  it("lança SaldoRemessaInsuficienteError quando saldo total é menor", async () => {
    const { tx } = createFifoMock([item("i1", "r1", 1, "2026-01-01", 1)]);

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

  it("estornarConsumosRemessa devolve saldo nas linhas originais", async () => {
    const { tx, items } = createFifoMock([item("i1", "r1", 10, "2026-01-01", 1)]);

    await consumirSaldoRemessaFifo(tx, tenantId, productId, 4, "retorno-x");
    assert.equal(items.get("i1")!.saldoDisponivel, 6);

    const estornos = await estornarConsumosRemessa(tx, "retorno-x");
    assert.deepEqual(estornos, [{ remessaNfeId: "r1", nfeItemId: "i1", quantidade: 4 }]);
    assert.equal(items.get("i1")!.saldoDisponivel, 10);
  });

  it("debitarSaldoRemessaPorCd filtra por unidade de destino", async () => {
    const { tx, items } = createFifoMock([
      item("ia", "cd-a", 5, "2026-01-01", 1, "unidade-a"),
      item("ib", "cd-b", 8, "2026-01-02", 2, "unidade-b"),
    ]);

    await debitarSaldoRemessaPorCd(tx, tenantId, productId, 3, "unidade-b");

    assert.equal(items.get("ia")!.saldoDisponivel, 5);
    assert.equal(items.get("ib")!.saldoDisponivel, 5);
  });

  it("ignora linhas com saldo zero", async () => {
    const { tx } = createFifoMock([
      item("vazia", "r0", 0, "2026-01-01", 1),
      item("ok", "r1", 4, "2026-01-02", 2),
    ]);

    const alocacoes = await consumirSaldoRemessaFifo(tx, tenantId, productId, 2, "ret-1");
    assert.deepEqual(alocacoes, [{ remessaNfeId: "r1", nfeItemId: "ok", quantidade: 2 }]);
  });
});

describe("realignRemessaFifoProductIdsBySku", () => {
  it("atualiza product_id das linhas FIFO para o cadastro atual do SKU", async () => {
    const cadastroId = "prod-cadastro";
    const legadoId = "prod-legado";
    const sku = "4133250001";
    let updated = 0;

    const prisma = {
      product: {
        findFirst: async ({ where }: { where: { tenantId?: string; sku?: string } }) => {
          if (where.tenantId === tenantId && where.sku === sku) {
            return { id: cadastroId };
          }
          return null;
        },
      },
      nfeItem: {
        updateMany: async ({
          where,
        }: {
          where: { productId?: { not: string } };
        }) => {
          if (where.productId?.not === cadastroId) {
            updated = 2;
            return { count: 2 };
          }
          return { count: 0 };
        },
      },
    } as unknown as PrismaClient;

    const result = await realignRemessaFifoProductIdsBySku(prisma, tenantId, sku);

    assert.equal(result.atualizados, 2);
    assert.equal(result.productId, cadastroId);
    assert.equal(updated, 2);
  });
});

describe("listarSaldoRemessaPorCd", () => {
  it("agrega saldo FIFO por CD de destino da remessa", async () => {
    const prisma = {
      nfeItem: {
        findMany: async () => [
          {
            productId,
            saldoDisponivel: 5,
            nfe: {
              unidadeDestinoId: "unidade-a",
              unidadeDestino: { codigo: "SP01", nome: "Cajamar", uf: "SP" },
            },
          },
          {
            productId,
            saldoDisponivel: 3,
            nfe: {
              unidadeDestinoId: "unidade-a",
              unidadeDestino: { codigo: "SP01", nome: "Cajamar", uf: "SP" },
            },
          },
          {
            productId,
            saldoDisponivel: 7,
            nfe: {
              unidadeDestinoId: "unidade-b",
              unidadeDestino: { codigo: "SC01", nome: "Joinville", uf: "SC" },
            },
          },
        ],
      },
    } as unknown as PrismaClient;

    const rows = await listarSaldoRemessaPorCd(prisma, tenantId, productId);

    assert.equal(rows.length, 2);
    assert.equal(rows.find((r) => r.unidadeDestinoId === "unidade-a")?.saldo, 8);
    assert.equal(rows.find((r) => r.unidadeDestinoId === "unidade-b")?.saldo, 7);
    assert.equal(rows[0]!.unidade?.codigo, "SC01");
    assert.equal(rows[1]!.unidade?.codigo, "SP01");
  });
});
