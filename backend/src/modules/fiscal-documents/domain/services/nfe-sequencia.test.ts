import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeProximoNumeroNfe } from "@msimulation-xml/fiscal-core";
import { proximoNumeroNfe, ultimoNumeroNfe } from "./nfe-sequencia.js";

describe("proximoNumeroNfe", () => {
  it("aplica numeroInicial quando não há NF-e emitida", async () => {
    const calls: unknown[] = [];
    const prisma = {
      nFe: {
        findFirst: async (args: unknown) => {
          calls.push(args);
          return null;
        },
      },
    };

    const numero = await proximoNumeroNfe(prisma as never, "tenant-1", 5, 100);
    assert.equal(numero, 100);
    assert.equal(calls.length, 1);
  });

  it("incrementa após última emissão respeitando piso configurado", async () => {
    const prisma = {
      nFe: {
        findFirst: async () => ({ numero: 149 }),
      },
    };

    assert.equal(await proximoNumeroNfe(prisma as never, "tenant-1", 5, 100), 150);
    assert.equal(await proximoNumeroNfe(prisma as never, "tenant-1", 5, 200), 200);
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
