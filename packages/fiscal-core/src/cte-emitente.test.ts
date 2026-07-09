import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultCteEmitente,
  mapLogisticsUnitToCteEmitente,
} from "./cte-emitente.js";

describe("cte-emitente", () => {
  it("mapeia unidade ML para emitente CT-e", () => {
    const emitente = mapLogisticsUnitToCteEmitente({
      cnpj: "03.007.331/0074-05",
      ie: "241174886113",
      destNomeFiscal: "EBAZAR.COM.BR LTDA",
      nome: "Cajamar SP",
      logradouro: "Av Antonio Candido Machado",
      numero: "3100",
      bairro: "Empresarial Paineira",
      codigoMunicipio: "3509205",
      municipio: "Cajamar",
      uf: "SP",
      cep: "07776-037",
    });

    assert.equal(emitente.cnpj, "03007331007405");
    assert.equal(emitente.nome, "EBAZARCOMBR LTDA");
    assert.equal(emitente.uf, "SP");
    assert.equal(emitente.codigoMunicipio, "3509205");
  });

  it("defaultCteEmitente mantém fallback RJ", () => {
    assert.equal(defaultCteEmitente().uf, "RJ");
  });
});
