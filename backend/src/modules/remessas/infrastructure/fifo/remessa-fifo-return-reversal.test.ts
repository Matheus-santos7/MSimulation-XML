import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reverseRemessaFifoConsumptionsForReturn } from "./remessa-fifo-consumption.js";

/**
 * Cenário: retorno simbólico "ret-1" consumiu, na ordem:
 *   c1 → item i1 (produto A, remessa r1) × 1
 *   c2 → item i2 (produto B, remessa r1) × 1
 *   c3 → item i3 (produto B, remessa r2) × 1
 * Venda: A × 1, B × 2. Todos os itens ficaram com saldo 0 após o consumo.
 */
function createMock() {
  const saldo = new Map<string, number>([
    ["i1", 0],
    ["i2", 0],
    ["i3", 0],
  ]);
  const consumos = [
    { id: "c1", remessaNfeId: "r1", nfeItemId: "i1", quantidade: 1, nfeItem: { productId: "A" } },
    { id: "c2", remessaNfeId: "r1", nfeItemId: "i2", quantidade: 1, nfeItem: { productId: "B" } },
    { id: "c3", remessaNfeId: "r2", nfeItemId: "i3", quantidade: 1, nfeItem: { productId: "B" } },
  ];
  const tx = {
    nfeRemessaConsumo: {
      findMany: async ({ where }: { where: { retornoNfeId: string } }) =>
        where.retornoNfeId === "ret-1" ? consumos : [],
    },
    nfeItem: {
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { saldoDisponivel: { increment: number } };
      }) => {
        saldo.set(where.id, (saldo.get(where.id) ?? 0) + data.saldoDisponivel.increment);
      },
    },
  } as unknown as Parameters<typeof reverseRemessaFifoConsumptionsForReturn>[0];
  return { tx, saldo };
}

describe("reverseRemessaFifoConsumptionsForReturn", () => {
  it("primeira devolução parcial de B credita só o primeiro consumo de B", async () => {
    const { tx, saldo } = createMock();
    const estornos = await reverseRemessaFifoConsumptionsForReturn(tx, "ret-1", [
      { productIds: ["B"], quantidade: 1, jaEstornado: 0 },
    ]);
    assert.deepEqual(estornos, [{ remessaNfeId: "r1", nfeItemId: "i2", quantidade: 1 }]);
    assert.deepEqual([...saldo.values()], [0, 1, 0]);
  });

  it("segunda devolução parcial de B pula o que já foi estornado e credita o consumo seguinte", async () => {
    const { tx, saldo } = createMock();
    const estornos = await reverseRemessaFifoConsumptionsForReturn(tx, "ret-1", [
      { productIds: ["B"], quantidade: 1, jaEstornado: 1 },
    ]);
    assert.deepEqual(estornos, [{ remessaNfeId: "r2", nfeItemId: "i3", quantidade: 1 }]);
    assert.deepEqual([...saldo.values()], [0, 0, 1]);
  });

  it("devolução integral (todas as linhas, nada estornado antes) credita todos os consumos", async () => {
    const { tx, saldo } = createMock();
    const estornos = await reverseRemessaFifoConsumptionsForReturn(tx, "ret-1", [
      { productIds: ["A"], quantidade: 1, jaEstornado: 0 },
      { productIds: ["B"], quantidade: 2, jaEstornado: 0 },
    ]);
    assert.deepEqual(estornos, [
      { remessaNfeId: "r1", nfeItemId: "i1", quantidade: 1 },
      { remessaNfeId: "r1", nfeItemId: "i2", quantidade: 1 },
      { remessaNfeId: "r2", nfeItemId: "i3", quantidade: 1 },
    ]);
    assert.deepEqual([...saldo.values()], [1, 1, 1]);
  });

  it("janela parcial dentro de um consumo maior que a quantidade devolvida", async () => {
    const saldo = new Map<string, number>([["i1", 0]]);
    const tx = {
      nfeRemessaConsumo: {
        findMany: async () => [
          { id: "c1", remessaNfeId: "r1", nfeItemId: "i1", quantidade: 5, nfeItem: { productId: "A" } },
        ],
      },
      nfeItem: {
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { saldoDisponivel: { increment: number } };
        }) => {
          saldo.set(where.id, (saldo.get(where.id) ?? 0) + data.saldoDisponivel.increment);
        },
      },
    } as unknown as Parameters<typeof reverseRemessaFifoConsumptionsForReturn>[0];

    const estornos = await reverseRemessaFifoConsumptionsForReturn(tx, "ret-1", [
      { productIds: ["A"], quantidade: 2, jaEstornado: 2 },
    ]);
    assert.deepEqual(estornos, [{ remessaNfeId: "r1", nfeItemId: "i1", quantidade: 2 }]);
    assert.equal(saldo.get("i1"), 2);
  });

  it("produto sem consumo registrado não credita nada nem lança", async () => {
    const { tx, saldo } = createMock();
    const estornos = await reverseRemessaFifoConsumptionsForReturn(tx, "ret-1", [
      { productIds: ["Z"], quantidade: 1, jaEstornado: 0 },
    ]);
    assert.deepEqual(estornos, []);
    assert.deepEqual([...saldo.values()], [0, 0, 0]);
  });

  it("aceita IDs legados do produto (linhas FIFO realinhadas por SKU)", async () => {
    const { tx, saldo } = createMock();
    const estornos = await reverseRemessaFifoConsumptionsForReturn(tx, "ret-1", [
      { productIds: ["A-novo", "A"], quantidade: 1, jaEstornado: 0 },
    ]);
    assert.deepEqual(estornos, [{ remessaNfeId: "r1", nfeItemId: "i1", quantidade: 1 }]);
    assert.equal(saldo.get("i1"), 1);
  });
});
