import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultCteEmitente } from "@msimulation-xml/fiscal-core";
import { resolveCteEmitente } from "./resolve-cte-emitente.js";

const tenant = {
  id: "t1",
  uf: "SP",
} as const;

const cdSp = {
  cnpj: "03007331007405",
  ie: "241174886113",
  destNomeFiscal: "EBAZAR.COM.BR LTDA",
  nome: "Cajamar",
  logradouro: "Av Antonio Candido Machado",
  numero: "3100",
  bairro: "Centro",
  codigoMunicipio: "3509205",
  municipio: "Cajamar",
  uf: "SP",
  cep: "07776037",
};

function prismaStub(units: typeof cdSp[], links: { unidadeId: string; padrao: boolean }[]) {
  return {
    meliUnidadeLogistica: {
      findFirst: async ({ where }: { where: { id?: string; uf?: string } }) => {
        if (where.id) {
          const link = links.find((l) => l.unidadeId === where.id);
          if (!link) return null;
          return units.find((u) => u.uf === where.uf) ?? null;
        }
        return null;
      },
    },
    tenantUnidadeLogistica: {
      findFirst: async ({
        where,
      }: {
        where: { tenantId: string; padrao?: boolean; unidade?: { uf?: string } };
      }) => {
        const uf = where.unidade?.uf;
        const match = links.find((l) => {
          const unit = units.find((u) => u.uf === uf);
          return unit && l.padrao === (where.padrao ?? false);
        });
        if (!match) {
          const any = links[0];
          const unit = units.find((u) => u.uf === uf);
          return unit ? { unidade: unit } : null;
        }
        const unit = units.find((u) => u.uf === uf);
        return unit ? { unidade: unit } : null;
      },
    },
    nFe: {
      findUnique: async () => null,
    },
  } as Parameters<typeof resolveCteEmitente>[0];
}

describe("resolveCteEmitente", () => {
  it("venda usa CD na UF do consumidor", async () => {
    const prisma = prismaStub([cdSp], [{ unidadeId: "cd-sp", padrao: true }]);
    const emitente = await resolveCteEmitente(
      prisma,
      "t1",
      tenant as never,
      { id: "nfe-venda", destUf: "SP", unidadeDestinoId: "cd-sp" },
      "venda",
    );
    assert.equal(emitente.cnpj, "03007331007405");
    assert.equal(emitente.uf, "SP");
  });

  it("remessa cross-UF usa CD na UF de destino", async () => {
    const prisma = prismaStub([cdSp], [{ unidadeId: "cd-sp", padrao: true }]);
    const emitente = await resolveCteEmitente(
      prisma,
      "t1",
      { ...tenant, uf: "RJ" } as never,
      { id: "nfe-rem", destUf: "SP", unidadeDestinoId: "cd-sp" },
      "remessa",
    );
    assert.equal(emitente.cnpj, "03007331007405");
    assert.equal(emitente.uf, "SP");
  });

  it("remessa sem CD na UF de destino mantém fallback RJ", async () => {
    const prisma = prismaStub([cdSp], [{ unidadeId: "cd-sp", padrao: true }]);
    const emitente = await resolveCteEmitente(
      prisma,
      "t1",
      tenant as never,
      { id: "nfe-rem", destUf: "BA", unidadeDestinoId: null },
      "remessa",
    );
    assert.equal(emitente.uf, defaultCteEmitente().uf);
  });
});
