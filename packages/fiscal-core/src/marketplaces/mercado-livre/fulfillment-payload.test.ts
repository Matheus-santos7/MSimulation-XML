import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { estimateRemessaPesoVol } from "../fulfillment-payload.js";
import { enrichMercadoLivreFulfillmentPayload } from "./fulfillment-payload.js";
import { ML_ID_CAD_INT_TRAN_PADRAO } from "./intermediador.js";

describe("Mercado Livre — payload de fulfillment", () => {
  it("estimateRemessaPesoVol — 3 unidades como XML ML", () => {
    const vol = estimateRemessaPesoVol(3);
    assert.equal(vol.qVol, 3);
    assert.equal(vol.pesoL, 2.1);
    assert.equal(vol.pesoB, 2.13);
  });

  it("enrichMercadoLivreFulfillmentPayload preenche logística e intermediário", () => {
    const out = enrichMercadoLivreFulfillmentPayload(
      { engine: { itens: [] }, obsContXTexto: "INBOUND-inbound-ORDER-1-1-OLSS-279642028" },
      {
        quantidadeTotal: 3,
        destIe: "241174886113",
        idCadIntTran: "3272442934",
      },
    );

    assert.equal((out.infIntermed as { idCadIntTran: string }).idCadIntTran, "3272442934");
    assert.equal(out.obsContXTexto, "INBOUND-inbound-ORDER-1-1-OLSS-3272442934");
    assert.equal(out.destIe, "241174886113");
    assert.ok(out.transporta);
    assert.equal((out.transporta as { xNome: string }).xNome, "Transgoss Transporte e Logistica");
    assert.equal((out.transp as { qVol: number }).qVol, 3);
    assert.equal((out.transp as { pesoL: number }).pesoL, 2.1);
    assert.deepEqual(out.ibsCbs, { st: "410", cClassTrib: "410999" });
    assert.equal((out.autXmlCpfs as string[]).length, 2);
  });

  it("não sobrescreve transporta/transp já definidos", () => {
    const out = enrichMercadoLivreFulfillmentPayload(
      {
        transporta: { cnpj: "11111111000111" },
        transp: { qVol: 2, pesoL: 9, pesoB: 10 },
      },
      { quantidadeTotal: 1 },
    );
    assert.equal((out.transporta as { cnpj: string }).cnpj, "11111111000111");
    assert.equal((out.transp as { pesoL: number }).pesoL, 9);
  });

  it("usa id padrão quando unidade não informa idCadIntTran", () => {
    const out = enrichMercadoLivreFulfillmentPayload({}, { quantidadeTotal: 1 });
    assert.equal(
      (out.infIntermed as { idCadIntTran: string }).idCadIntTran,
      ML_ID_CAD_INT_TRAN_PADRAO,
    );
  });
});
