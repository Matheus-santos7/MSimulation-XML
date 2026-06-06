import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NFeTipo } from "../generated/prisma/client.js";
import { consumirSaldoRemessaFifo } from "./remessa-fifo.js";

/**
 * Contratos da cadeia de venda (sem Prisma real).
 * xTexto: `@msimulation-xml/fiscal-core` — ver `packages/fiscal-core/src/nfe-xtexto.test.ts`
 */

const tenantId = "t1";
const productId = "p1";

describe("venda-chain — contrato refNFe (FIFO)", () => {
  it("alocação FIFO[0] é a remessa principal para nfeReferenciaId do retorno", async () => {
    const nfes = new Map([
      [
        "remessa-antiga",
        {
          id: "remessa-antiga",
          tenantId,
          productId,
          tipo: NFeTipo.REMESSA,
          saldoDisponivel: 5,
          emitidaEm: new Date("2025-06-01"),
          numero: 1,
          deletedAt: null,
          unidadeDestinoId: null,
        },
      ],
      [
        "remessa-recente",
        {
          id: "remessa-recente",
          tenantId,
          productId,
          tipo: NFeTipo.REMESSA,
          saldoDisponivel: 5,
          emitidaEm: new Date("2026-01-01"),
          numero: 2,
          deletedAt: null,
          unidadeDestinoId: null,
        },
      ],
    ]);
    const consumos: { retornoNfeId: string; remessaNfeId: string; quantidade: number }[] = [];
    const tx = {
      nFe: {
        findMany: async () =>
          [...nfes.values()].sort(
            (a, b) => a.emitidaEm.getTime() - b.emitidaEm.getTime() || a.numero - b.numero,
          ),
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { saldoDisponivel: number };
        }) => {
          nfes.get(where.id)!.saldoDisponivel = data.saldoDisponivel;
        },
      },
      nfeRemessaConsumo: {
        create: async ({ data }: { data: (typeof consumos)[number] }) => {
          consumos.push(data);
        },
        findMany: async () => consumos,
      },
    };

    const alocacoes = await consumirSaldoRemessaFifo(tx, tenantId, productId, 2, "retorno-id");
    const nfeReferenciaIdRetorno = alocacoes[0]!.remessaNfeId;

    assert.equal(nfeReferenciaIdRetorno, "remessa-antiga");
    const nfeReferenciaIdVenda = "retorno-id";
    assert.notEqual(nfeReferenciaIdVenda, nfeReferenciaIdRetorno);
  });
});
