import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  destIeRetornoFromRemessa,
  destinoRetornoFromRemessa,
  resolveRetornoSimbolicoCfop,
} from "./retorno-simbolico-dest.js";

describe("destinoRetornoFromRemessa", () => {
  it("preenche cMun a partir da unidade destino quando a remessa está vazia", () => {
    const destino = destinoRetornoFromRemessa(
      {
        destNome: "EBAZAR.COM.BR LTDA",
        destDoc: "03007331012077",
        destUf: "SC",
        destLogradouro: "",
        destNumero: "",
        destComplemento: null,
        destBairro: "",
        destCodigoMunicipio: "",
        destMunicipio: "",
        destCep: "",
        destCodigoPais: 1058,
        destNomePais: "Brasil",
        destTelefone: null,
        destIndIeDest: 1,
        fiscalPayload: {},
      },
      {
        ie: "261755994",
        codigoMunicipio: "4206009",
        municipio: "Governador Celso Ramos",
        bairro: "Guaporanga",
        logradouro: "Av. Papenborg",
        numero: "S/N",
        cep: "88195900",
      },
    );

    assert.equal(destino.destCodigoMunicipio, "4206009");
    assert.equal(destino.destMunicipio, "Governador Celso Ramos");
    assert.equal(destino.destBairro, "Guaporanga");
  });
});

describe("destIeRetornoFromRemessa", () => {
  it("usa fiscalPayload.destIe quando presente", () => {
    assert.equal(
      destIeRetornoFromRemessa(
        { fiscalPayload: { destIe: "123.456.789" } },
        { ie: "999999999" },
      ),
      "123456789",
    );
  });

  it("cai na IE da unidade quando o payload não tem destIe", () => {
    assert.equal(
      destIeRetornoFromRemessa({ fiscalPayload: {} }, { ie: "241174886113" }),
      "241174886113",
    );
  });

  it("retorna undefined quando payload e unidade não têm IE", () => {
    assert.equal(destIeRetornoFromRemessa({ fiscalPayload: {} }, { ie: null }), undefined);
    assert.equal(destIeRetornoFromRemessa({ fiscalPayload: null }, null), undefined);
  });
});

describe("resolveRetornoSimbolicoCfop", () => {
  it("usa 1949 na mesma UF (entrada intraestadual)", () => {
    assert.equal(resolveRetornoSimbolicoCfop("PR", "PR"), "1949");
    assert.equal(resolveRetornoSimbolicoCfop("sp", "SP"), "1949");
  });

  it("usa 2949 entre UFs diferentes (entrada interestadual)", () => {
    assert.equal(resolveRetornoSimbolicoCfop("PR", "SC"), "2949");
    assert.equal(resolveRetornoSimbolicoCfop("SP", "MG"), "2949");
  });

  it("cobertura dos 6 CFOPs via natureza / remessa", () => {
    assert.equal(
      resolveRetornoSimbolicoCfop("SP", "SP", { natureza: "retorno_venda_fora" }),
      "1904",
    );
    assert.equal(
      resolveRetornoSimbolicoCfop("SP", "MG", { natureza: "retorno_venda_fora" }),
      "2904",
    );
    assert.equal(
      resolveRetornoSimbolicoCfop("SP", "SP", { natureza: "retorno_deposito" }),
      "1907",
    );
    assert.equal(
      resolveRetornoSimbolicoCfop("SP", "SC", { natureza: "retorno_deposito" }),
      "2907",
    );
    assert.equal(resolveRetornoSimbolicoCfop("PR", "PR", { remessaCfop: "5905" }), "1907");
    assert.equal(resolveRetornoSimbolicoCfop("PR", "SC", { remessaCfop: "6905" }), "2907");
  });
});
