import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REMESSA_CFOP_INTERSTATE,
  REMESSA_CFOP_INTRASTATE,
  resolveRemessaCfop,
} from "./helpers/remessa-dest.js";
import { prepararRemessaSimbolicaFiscal } from "./remessa-simbolica-fiscal.js";

const tenantId = "tenant-test";

const mockTaxRuleRow = {
  ruleId: "4133250058-SP-taxpayer-inbound",
  origin: "SP",
  payload: {
    taxes: {
      icms: { st: "00 - Tributada integralmente", aliquota: 18 },
      pis: { st: "09 - Operação com Suspensão da Contribuição", aliquota: 0 },
      cofins: { st: "09 - Operação com Suspensão da Contribuição", aliquota: 0 },
      ipi: { st: "55 - Saída com Suspensão", aliquota: 0, codEnq: 103 },
    },
    icmsByUf: {
      ICMS_SP_PICMS_INTERNAL: 18,
      ICMS_SP_CST: "00",
      ICMS_SC_PICMS_INTERNAL: 17,
      ICMS_SC_CST: "00",
      ICMS_SC_PICMS_INTERSTATE: 12,
    },
  },
};

const product = {
  id: "prod-1",
  sku: "SKU-TEST",
  nome: "Produto teste",
  ncm: "61091000",
  preco: 100,
  precoCusto: 50,
  taxRuleBaseId: "4133250058",
};

function createPrismaMock() {
  return {
    taxRule: {
      findUnique: async () => mockTaxRuleRow,
    },
    fiscalEmitterSettings: {
      findUnique: async () => null,
    },
  };
}

describe("prepararRemessaSimbolicaFiscal — CFOP", () => {
  it("usa 5949 quando emitente e destinatário estão na mesma UF", async () => {
    const result = await prepararRemessaSimbolicaFiscal(createPrismaMock(), {
      tenantId,
      emitUf: "SP",
      destUf: "SP",
      product,
      quantidade: 2,
      pedidoMl: "ORDER-SP-SP",
    });

    assert.equal(result.cfop, REMESSA_CFOP_INTRASTATE);
    assert.equal(resolveRemessaCfop("SP", "SP"), REMESSA_CFOP_INTRASTATE);
  });

  it("usa 6949 quando emitente e destinatário estão em UFs diferentes", async () => {
    const result = await prepararRemessaSimbolicaFiscal(createPrismaMock(), {
      tenantId,
      emitUf: "SP",
      destUf: "SC",
      product,
      quantidade: 2,
      pedidoMl: "ORDER-SP-SC",
    });

    assert.equal(result.cfop, REMESSA_CFOP_INTERSTATE);
    assert.equal(resolveRemessaCfop("SP", "SC"), REMESSA_CFOP_INTERSTATE);
  });
});

describe("avanço CD interestadual (SP origem → SC destino)", () => {
  it("remessa simbólica (saída CD origem SP) usa CFOP intrastadual 5949", async () => {
    const simbolica = await prepararRemessaSimbolicaFiscal(createPrismaMock(), {
      tenantId,
      emitUf: "SP",
      destUf: "SP",
      product,
      quantidade: 1,
      pedidoMl: "AVANCO-SIMB",
    });

    assert.equal(simbolica.cfop, "5949");
  });

  it("remessa física ao CD destino SC usa CFOP interestadual 6949", () => {
    assert.equal(resolveRemessaCfop("SP", "SC"), "6949");
  });
});
