import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DevolucaoItensError,
  computeReturnableLines,
  resolveRequestedReturnLines,
  type SaleReturnLine,
} from "./devolucao-itens.js";

const saleLines: SaleReturnLine[] = [
  { numeroItem: 1, productId: "A", quantidade: 1 },
  { numeroItem: 2, productId: "B", quantidade: 2 },
];

describe("computeReturnableLines", () => {
  it("sem devoluções anteriores tudo está disponível", () => {
    const lines = computeReturnableLines(saleLines, []);
    assert.deepEqual(
      lines.map((l) => [l.numeroItem, l.quantidadeDevolvida, l.quantidadeDisponivel]),
      [
        [1, 0, 1],
        [2, 0, 2],
      ],
    );
  });

  it("desconta as quantidades das devoluções anteriores por produto", () => {
    const lines = computeReturnableLines(saleLines, [
      { itens: [{ productId: "B", quantidade: 1 }] },
    ]);
    assert.deepEqual(
      lines.map((l) => [l.numeroItem, l.quantidadeDevolvida, l.quantidadeDisponivel]),
      [
        [1, 0, 1],
        [2, 1, 1],
      ],
    );
  });

  it("devolução legada sem itens conta como integral", () => {
    const lines = computeReturnableLines(saleLines, [{ itens: [] }]);
    assert.deepEqual(
      lines.map((l) => l.quantidadeDisponivel),
      [0, 0],
    );
  });

  it("mesmo produto em duas linhas: devolvido é alocado na ordem das linhas", () => {
    const lines = computeReturnableLines(
      [
        { numeroItem: 1, productId: "A", quantidade: 2 },
        { numeroItem: 2, productId: "A", quantidade: 3 },
      ],
      [{ itens: [{ productId: "A", quantidade: 3 }] }],
    );
    assert.deepEqual(
      lines.map((l) => [l.quantidadeDevolvida, l.quantidadeDisponivel]),
      [
        [2, 0],
        [1, 2],
      ],
    );
  });

  it("nunca deixa disponível negativo se o devolvido exceder o vendido", () => {
    const lines = computeReturnableLines(saleLines, [
      { itens: [{ productId: "A", quantidade: 5 }] },
    ]);
    assert.equal(lines[0]!.quantidadeDisponivel, 0);
    assert.equal(lines[0]!.quantidadeDevolvida, 1);
  });
});

describe("resolveRequestedReturnLines", () => {
  const available = computeReturnableLines(saleLines, [
    { itens: [{ productId: "B", quantidade: 1 }] },
  ]);

  it("sem pedido explícito devolve tudo que resta", () => {
    const result = resolveRequestedReturnLines(available);
    assert.deepEqual(result, [
      { numeroItem: 1, productId: "A", quantidade: 1 },
      { numeroItem: 2, productId: "B", quantidade: 1 },
    ]);
  });

  it("pedido explícito respeita linhas e quantidades", () => {
    const result = resolveRequestedReturnLines(available, [{ numeroItem: 2, quantidade: 1 }]);
    assert.deepEqual(result, [{ numeroItem: 2, productId: "B", quantidade: 1 }]);
  });

  it("409 quando nada resta a devolver", () => {
    const nothing = computeReturnableLines(saleLines, [{ itens: [] }]);
    assert.throws(
      () => resolveRequestedReturnLines(nothing),
      (e: unknown) => e instanceof DevolucaoItensError && e.status === 409,
    );
    assert.throws(
      () => resolveRequestedReturnLines(nothing, [{ numeroItem: 1, quantidade: 1 }]),
      (e: unknown) => e instanceof DevolucaoItensError && e.status === 409,
    );
  });

  it("422 para item inexistente, duplicado, quantidade inválida ou acima do disponível", () => {
    const is422 = (e: unknown) => e instanceof DevolucaoItensError && e.status === 422;
    assert.throws(
      () => resolveRequestedReturnLines(available, [{ numeroItem: 9, quantidade: 1 }]),
      is422,
    );
    assert.throws(
      () =>
        resolveRequestedReturnLines(available, [
          { numeroItem: 1, quantidade: 1 },
          { numeroItem: 1, quantidade: 1 },
        ]),
      is422,
    );
    assert.throws(
      () => resolveRequestedReturnLines(available, [{ numeroItem: 1, quantidade: 0 }]),
      is422,
    );
    assert.throws(
      () => resolveRequestedReturnLines(available, [{ numeroItem: 1, quantidade: 1.5 }]),
      is422,
    );
    assert.throws(
      () => resolveRequestedReturnLines(available, [{ numeroItem: 2, quantidade: 2 }]),
      (e: unknown) => is422(e) && /dispon[ií]vel 1/i.test((e as Error).message),
    );
  });

  it("pedido explícito vazio equivale a devolver tudo que resta", () => {
    assert.deepEqual(resolveRequestedReturnLines(available, []), resolveRequestedReturnLines(available));
  });
});
