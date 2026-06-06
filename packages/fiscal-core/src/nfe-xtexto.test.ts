import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NFeTipo } from "./nfe-tipo.js";
import { buildNfeObsContXTexto, xTextoFromNfe } from "./nfe-xtexto.js";

describe("fiscal-core / nfe-xtexto", () => {
  it("retorno simbólico — padrão ML", () => {
    const pedidoMl = "123456789";
    assert.equal(
      buildNfeObsContXTexto({
        tipo: NFeTipo.RETORNO_SIMBOLICO,
        cfop: "1949",
        natOp: "Retorno Simbolico",
        pedidoMl,
      }),
      `SALE-symbolic_inbound_return-${pedidoMl}-1-OLSS-279642028`,
    );
  });

  it("venda consumidor final — só pedido ML", () => {
    const pedidoMl = "987654321";
    assert.equal(
      buildNfeObsContXTexto({
        tipo: NFeTipo.VENDA,
        cfop: "6107",
        natOp: "Venda de mercadoria para consumidor final",
        pedidoMl,
        indFinal: 1,
      }),
      pedidoMl,
    );
  });

  it("xTextoFromNfe aceita pedidoML legado do DTO", () => {
    assert.equal(
      xTextoFromNfe({
        tipo: NFeTipo.VENDA,
        cfop: "6107",
        natOp: "Venda de mercadoria para consumidor final",
        pedidoML: "555",
        destinatario: { indIEDest: 9 },
      }),
      "555",
    );
  });
});
