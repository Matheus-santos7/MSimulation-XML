import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOverrides,
  countOverrides,
  INHERIT,
  parseCpfList,
  toFormValues,
} from "./marketplace-billing-fields.js";

describe("faturador por marketplace — campos", () => {
  it("monta o formulário a partir da sobrescrita salva", () => {
    const values = toFormValues({ basic: { formaFaturamento: "EMISSOR_MARKETPLACE" } });

    assert.equal(values.basic.formaFaturamento, "EMISSOR_MARKETPLACE");
    assert.equal(values.basic.perfilVendedor, INHERIT);
    assert.equal(values.autXmlCpfs, null);
  });

  it("grava só o que foi sobrescrito e preserva o que a tela não edita", () => {
    const overrides = buildOverrides(
      { basic: { dadosFiscaisAnunciosOk: true }, taxes: { calculoDifal: {} as never } },
      {
        basic: {
          formaFaturamento: "EMISSOR_PROPRIO",
          perfilVendedor: INHERIT,
          logisticaPadrao: INHERIT,
          retornoSimbolicoNatureza: INHERIT,
        },
        autXmlCpfs: ["12345678909"],
      },
    );

    assert.deepEqual(overrides, {
      basic: { dadosFiscaisAnunciosOk: true, formaFaturamento: "EMISSOR_PROPRIO" },
      taxes: { calculoDifal: {} },
      nfe: { autXmlCpfs: ["12345678909"] },
    });
  });

  it("herdar tudo volta a sobrescrita vazia", () => {
    const overrides = buildOverrides(
      { basic: { formaFaturamento: "EMISSOR_MARKETPLACE" }, nfe: { autXmlCpfs: ["1"] } },
      {
        basic: {
          formaFaturamento: INHERIT,
          perfilVendedor: INHERIT,
          logisticaPadrao: INHERIT,
          retornoSimbolicoNatureza: INHERIT,
        },
        autXmlCpfs: null,
      },
    );

    assert.deepEqual(overrides, {});
    assert.equal(countOverrides(overrides), 0);
  });

  it("conta os campos sobrescritos em todos os grupos", () => {
    assert.equal(
      countOverrides({ basic: { formaFaturamento: "EMISSOR_PROPRIO" }, nfe: { autXmlCpfs: [] } }),
      2,
    );
  });

  it("lê CPFs separados por linha, vírgula ou ponto e vírgula", () => {
    assert.deepEqual(parseCpfList("123.456.789-09\n987.654.321-00; 111"), [
      "12345678909",
      "98765432100",
      "111",
    ]);
  });
});
