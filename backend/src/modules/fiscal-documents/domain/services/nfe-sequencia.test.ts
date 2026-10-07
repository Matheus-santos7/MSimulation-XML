import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeProximoNumeroNfe } from "@msimulation-xml/fiscal-core";
import { proximoNumeroNfe, ultimoNumeroNfe } from "./nfe-sequencia.js";

describe("proximoNumeroNfe", () => {
  it("aplica numeroInicial quando não há NF-e emitida", async () => {
    const calls: unknown[] = [];
    const prisma = {
      $executeRaw: async () => 1,
      nFe: {
        findFirst: async (args: unknown) => {
          calls.push(args);
          return null;
        },
      },
      nfeInutilizacao: {
        findMany: async () => [],
      },
    };

    const numero = await proximoNumeroNfe(prisma as never, "tenant-1", 5, 100);
    assert.equal(numero, 100);
    assert.equal(calls.length, 1);
  });

  it("incrementa após última emissão respeitando piso configurado", async () => {
    const prisma = {
      $executeRaw: async () => 1,
      nFe: {
        findFirst: async () => ({ numero: 149 }),
      },
      nfeInutilizacao: {
        findMany: async () => [],
      },
    };

    assert.equal(await proximoNumeroNfe(prisma as never, "tenant-1", 5, 100), 150);
    assert.equal(await proximoNumeroNfe(prisma as never, "tenant-1", 5, 200), 200);
  });

  it("pula números cobertos por inutilização antes de emitir", async () => {
    const prisma = {
      $executeRaw: async () => 1,
      nFe: {
        findFirst: async () => ({ numero: 100 }),
      },
      nfeInutilizacao: {
        findMany: async () => [{ numeroIni: 101, numeroFim: 105 }],
      },
    };

    assert.equal(await proximoNumeroNfe(prisma as never, "tenant-1", 58, 1), 106);
  });

  it("adquire o advisory lock da série antes de ler o último número", async () => {
    const ordem: string[] = [];
    const prisma = {
      $executeRaw: async (..._args: unknown[]) => {
        ordem.push("lock");
        return 1;
      },
      nFe: {
        findFirst: async () => {
          ordem.push("findFirst");
          return { numero: 10 };
        },
      },
      nfeInutilizacao: {
        findMany: async () => {
          ordem.push("findMany");
          return [];
        },
      },
    };

    await proximoNumeroNfe(prisma as never, "tenant-1", 5, 1);
    assert.equal(ordem[0], "lock");
    assert.deepEqual(new Set(ordem.slice(1)), new Set(["findFirst", "findMany"]));
  });
});

describe("ultimoNumeroNfe", () => {
  it("retorna null sem histórico", async () => {
    const prisma = {
      nFe: {
        findFirst: async () => null,
      },
    };
    assert.equal(await ultimoNumeroNfe(prisma as never, "tenant-1", 5), null);
  });
});

describe("computeProximoNumeroNfe re-export", () => {
  it("mantém contrato fiscal-core", () => {
    assert.equal(computeProximoNumeroNfe(null, 100), 100);
  });
});
