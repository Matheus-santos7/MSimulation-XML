import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REMESSA_CFOP_INTERSTATE,
  REMESSA_CFOP_INTRASTATE,
  resolveRemessaCfop,
} from "../helpers/remessa-dest.js";
import { prepareSymbolicShipmentFiscal } from "./symbolic-shipment-fiscal.js";

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

describe("prepareSymbolicShipmentFiscal — CFOP", () => {
  it("usa 5949 quando emitente e destinatário estão na mesma UF", async () => {
    const result = await prepareSymbolicShipmentFiscal(createPrismaMock(), {
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
    const result = await prepareSymbolicShipmentFiscal(createPrismaMock(), {
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
    const simbolica = await prepareSymbolicShipmentFiscal(createPrismaMock(), {
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

  it("grava destIe no fiscalPayload a partir da IE do CD destino", async () => {
    const result = await prepareSymbolicShipmentFiscal(createPrismaMock(), {
      tenantId,
      emitUf: "SP",
      destUf: "BA",
      product,
      quantidade: 5,
      pedidoMl: "2178649511016403",
      nfeTipo: "REMESSA_AVANCO",
      destIe: "123.456.789",
      idCadIntTran: "279642028",
    });

    assert.equal(result.fiscalPayload.destIe, "123456789");
    const intermed = result.fiscalPayload.infIntermed as { idCadIntTran?: string };
    assert.equal(intermed.idCadIntTran, "279642028");
  });
});

describe("prepareSymbolicShipmentFiscal — multi-item (reposição pós-devolução parcial)", () => {
  const productB = {
    id: "prod-2",
    sku: "SKU-B",
    nome: "Produto B",
    ncm: "61091000",
    preco: 40,
    precoCusto: 20,
    taxRuleBaseId: "4133250058",
  };

  it("itens[] gera engine com uma linha por produto e totais somados", async () => {
    const result = await prepareSymbolicShipmentFiscal(createPrismaMock(), {
      tenantId,
      emitUf: "SP",
      destUf: "SP",
      itens: [
        { product, quantidade: 1 },
        { product: productB, quantidade: 2 },
      ],
      pedidoMl: "PACK-1",
    });

    const [a, b] = result.calc.nota.itens;
    assert.equal(result.calc.nota.itens.length, 2);
    assert.equal(a!.codigo, "SKU-TEST");
    assert.equal(a!.quantidade, 1);
    assert.equal(a!.vProd, 50);
    assert.equal(b!.codigo, "SKU-B");
    assert.equal(b!.quantidade, 2);
    assert.equal(b!.vProd, 40);
    assert.equal(result.calc.nota.totais.vProd, 90);
    assert.equal(result.calc.valor, result.calc.nota.totais.vNF);
    assert.equal(result.calc.valorIcms, result.calc.nota.totais.vICMS);
    const transp = result.fiscalPayload.transp as { qVol: number };
    assert.equal(transp.qVol, 3);
  });

  it("linha única via itens[] equivale ao caminho product/quantidade", async () => {
    const legacy = await prepareSymbolicShipmentFiscal(createPrismaMock(), {
      tenantId,
      emitUf: "SP",
      destUf: "SC",
      product,
      quantidade: 2,
      pedidoMl: "PACK-2",
    });
    const viaItens = await prepareSymbolicShipmentFiscal(createPrismaMock(), {
      tenantId,
      emitUf: "SP",
      destUf: "SC",
      itens: [{ product, quantidade: 2 }],
      pedidoMl: "PACK-2",
    });
    assert.deepEqual(viaItens.calc, legacy.calc);
    assert.deepEqual(viaItens.fiscalPayload, legacy.fiscalPayload);
  });

  it("falha quando não há linhas", async () => {
    await assert.rejects(
      () =>
        prepareSymbolicShipmentFiscal(createPrismaMock(), {
          tenantId,
          emitUf: "SP",
          destUf: "SP",
          itens: [],
          pedidoMl: "PACK-3",
        }),
      /sem itens/i,
    );
  });
});
