import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NFeTipo } from "../../../../generated/prisma/client.js";
import { ordenarFifoParaVenda, type FifoVendaItem } from "./ordenar-fifo-venda.js";

function row(
  id: string,
  overrides: Partial<FifoVendaItem> = {},
): FifoVendaItem {
  return {
    id,
    nfeId: `nfe-${id}`,
    saldoDisponivel: 5,
    nfeTipo: NFeTipo.REMESSA,
    destUf: "SP",
    unidadeUf: "SP",
    unidadeDestinoId: "cd-sp",
    unidadeCodigo: "SP01",
    ...overrides,
  };
}

const defaultCd = { unitId: "cd-sp", codigo: "SP01" };

describe("ordenarFifoParaVenda", () => {
  it("prioriza saldo na UF do comprador", () => {
    const ordered = ordenarFifoParaVenda(
      [
        row("sp", { unidadeUf: "SP", nfeTipo: NFeTipo.REMESSA }),
        row("mg", { unidadeUf: "MG", nfeTipo: NFeTipo.REMESSA_AVANCO, unidadeDestinoId: "cd-mg" }),
      ],
      "MG",
      defaultCd,
    );
    assert.deepEqual(ordered.map((i) => i.id), ["mg", "sp"]);
  });

  it("sem saldo na UF do comprador, prefere avanço simbólico antes da remessa principal", () => {
    const ordered = ordenarFifoParaVenda(
      [
        row("sp-principal", {
          unidadeUf: "SP",
          nfeTipo: NFeTipo.REMESSA,
          unidadeDestinoId: "cd-sp",
          unidadeCodigo: "SP01",
        }),
        row("mg-avanco", {
          unidadeUf: "MG",
          nfeTipo: NFeTipo.REMESSA_AVANCO,
          unidadeDestinoId: "cd-mg",
          unidadeCodigo: "MG01",
        }),
      ],
      "RJ",
      defaultCd,
    );
    assert.deepEqual(ordered.map((i) => i.id), ["mg-avanco", "sp-principal"]);
  });

  it("prefere remessa física no CD padrão antes de remessa física em outro CD", () => {
    const ordered = ordenarFifoParaVenda(
      [
        row("pr-outro", {
          unidadeUf: "PR",
          nfeTipo: NFeTipo.REMESSA,
          unidadeDestinoId: "cd-pr",
          unidadeCodigo: "PR01",
        }),
        row("sp-padrao", {
          unidadeUf: "SP",
          nfeTipo: NFeTipo.REMESSA,
          unidadeDestinoId: "cd-sp",
          unidadeCodigo: "SP01",
        }),
      ],
      "RJ",
      defaultCd,
    );
    assert.deepEqual(ordered.map((i) => i.id), ["sp-padrao", "pr-outro"]);
  });

  it("preserva FIFO dentro do mesmo tier", () => {
    const ordered = ordenarFifoParaVenda(
      [
        row("avanco-novo", {
          unidadeUf: "MG",
          nfeTipo: NFeTipo.REMESSA_AVANCO,
          unidadeDestinoId: "cd-mg-2",
        }),
        row("avanco-antigo", {
          unidadeUf: "BA",
          nfeTipo: NFeTipo.REMESSA_AVANCO,
          unidadeDestinoId: "cd-ba",
        }),
      ],
      "RJ",
      defaultCd,
    );
    assert.deepEqual(ordered.map((i) => i.id), ["avanco-novo", "avanco-antigo"]);
  });
});
