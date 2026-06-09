import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  enrichFiscalPayloadMlFulfillment,
  estimateRemessaPesoVol,
  REMESSA_ML_INTERMED_ID_DEFAULT,
} from "./remessa-ml-payload.js";

describe("fiscal-core / remessa-ml-payload", () => {
  it("estimateRemessaPesoVol — 3 unidades como XML ML", () => {
    const vol = estimateRemessaPesoVol(3);
    assert.equal(vol.pesoL, 2.1);
    assert.equal(vol.pesoB, 2.13);
  });

  it("enrichFiscalPayloadMlFulfillment preenche logística e intermediário", () => {
    const out = enrichFiscalPayloadMlFulfillment({ engine: { itens: [] } }, {
      quantidadeTotal: 3,
      destIe: "241174886113",
      idCadIntTran: "3272442934",
    });

    assert.equal((out.infIntermed as { idCadIntTran: string }).idCadIntTran, "3272442934");
    assert.equal(out.destIe, "241174886113");
    assert.ok(out.transporta);
    assert.equal((out.transp as { pesoL: number }).pesoL, 2.1);
    assert.deepEqual(out.ibsCbs, { st: "410", cClassTrib: "410999" });
    assert.equal((out.autXmlCpfs as string[]).length, 2);
  });

  it("não sobrescreve transporta/transp já definidos", () => {
    const out = enrichFiscalPayloadMlFulfillment(
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
    const out = enrichFiscalPayloadMlFulfillment({}, { quantidadeTotal: 1 });
    assert.equal(
      (out.infIntermed as { idCadIntTran: string }).idCadIntTran,
      REMESSA_ML_INTERMED_ID_DEFAULT,
    );
  });
});
