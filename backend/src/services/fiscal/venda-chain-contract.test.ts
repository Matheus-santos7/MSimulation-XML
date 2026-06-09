import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NFeTipo } from "../../generated/prisma/client.js";
import { consumirSaldoRemessaFifo } from "./remessa-fifo.js";

/**
 * Contratos da cadeia de venda (sem Prisma real).
 * xTexto: `@msimulation-xml/fiscal-core` — ver `packages/fiscal-core/src/nfe-xtexto.test.ts`
 */

const tenantId = "t1";
const productId = "p1";

describe("venda-chain — contrato refNFe (FIFO)", () => {
  it("alocação FIFO[0] é a remessa principal para nfeReferenciaId do retorno", async () => {
    const items = new Map([
      [
        "item-antigo",
        {
          id: "item-antigo",
          tenantId,
          nfeId: "remessa-antiga",
          productId,
          numeroItem: 1,
          saldoDisponivel: 5,
          nfe: {
            tenantId,
            tipo: NFeTipo.REMESSA,
            emitidaEm: new Date("2025-06-01"),
            numero: 1,
            deletedAt: null as null,
            unidadeDestinoId: null,
          },
        },
      ],
      [
        "item-recente",
        {
          id: "item-recente",
          tenantId,
          nfeId: "remessa-recente",
          productId,
          numeroItem: 1,
          saldoDisponivel: 5,
          nfe: {
            tenantId,
            tipo: NFeTipo.REMESSA,
            emitidaEm: new Date("2026-01-01"),
            numero: 2,
            deletedAt: null as null,
            unidadeDestinoId: null,
          },
        },
      ],
    ]);
    const consumos: {
      retornoNfeId: string;
      remessaNfeId: string;
      nfeItemId: string;
      quantidade: number;
    }[] = [];
    const tx = {
      nfeItem: {
        findMany: async () =>
          [...items.values()].sort(
            (a, b) =>
              a.nfe.emitidaEm.getTime() - b.nfe.emitidaEm.getTime() ||
              a.nfe.numero - b.nfe.numero ||
              a.numeroItem - b.numeroItem,
          ),
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { saldoDisponivel: number };
        }) => {
          items.get(where.id)!.saldoDisponivel = data.saldoDisponivel;
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
