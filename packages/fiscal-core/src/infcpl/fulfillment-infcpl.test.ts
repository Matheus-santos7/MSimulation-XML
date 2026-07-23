import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFulfillmentInfCplText } from "./fulfillment-infcpl.js";

describe("buildFulfillmentInfCplText", () => {
  it("monta head + middle + regime com espacos", () => {
    const text = buildFulfillmentInfCplText({
      operation: "REMESSA",
      ufDestino: "SC",
      cnpjFilial: "03007331012077",
      middle: "Inscricao Estadual do Operador Logistico: 261755994.",
    });
    assert.equal(
      text,
      "Remessa para armazenamento em fulfillment. Inscricao Estadual do Operador Logistico: 261755994. Regime Especial SC - TTD SC n 225000004034256.",
    );
  });

  it("omite middle e regime quando vazios / sem match", () => {
    assert.equal(
      buildFulfillmentInfCplText({
        operation: "RETORNO_SIMBOLICO",
        ufDestino: "SP",
        cnpjFilial: "00000000000000",
      }),
      "Retorno simbolico de mercadoria armazenada em fulfillment.",
    );
  });

  it("usa heads ASCII de todas as operations fixas", () => {
    const cases: Array<[Parameters<typeof buildFulfillmentInfCplText>[0]["operation"], string]> = [
      ["REMESSA", "Remessa para armazenamento em fulfillment."],
      ["REMESSA_SIMBOLICA", "Remessa simbolica para armazenamento em fulfillment."],
      ["RETORNO_SIMBOLICO", "Retorno simbolico de mercadoria armazenada em fulfillment."],
      ["RETORNO_FISICO", "Retorno fisico de mercadoria armazenada em fulfillment."],
      ["VENDA_FULFILLMENT", "Venda de mercadoria armazenada em fulfillment."],
      ["TRANSFERENCIA", "Transferencia de mercadoria para estabelecimento de fulfillment."],
    ];
    for (const [operation, head] of cases) {
      assert.equal(
        buildFulfillmentInfCplText({ operation, ufDestino: "XX", cnpjFilial: "0" }),
        head,
      );
    }
  });

  it("interpola n+serie+data em DEVOLUCAO e INSULCESSO_DE_ENTREGA", () => {
    const origem = {
      numero: 100,
      serie: 1,
      emitidaEm: "2026-06-17T15:00:00.000Z",
    };
    assert.equal(
      buildFulfillmentInfCplText({
        operation: "DEVOLUCAO",
        ufDestino: "SP",
        cnpjFilial: "0",
        nfeOrigem: origem,
      }),
      "Devolucao de mercadoria referente a NF-e de origem n 100 serie 1 emitida em 17/06/2026.",
    );
    assert.equal(
      buildFulfillmentInfCplText({
        operation: "INSULCESSO_DE_ENTREGA",
        ufDestino: "SP",
        cnpjFilial: "0",
        nfeOrigem: origem,
      }),
      "Insucesso de entrega de mercadoria referente a NF-e de origem n 100 serie 1 emitida em 17/06/2026.",
    );
  });

  it("falha DEVOLUCAO/INSULCESSO sem nfeOrigem válida", () => {
    assert.throws(
      () =>
        buildFulfillmentInfCplText({
          operation: "DEVOLUCAO",
          ufDestino: "SC",
          cnpjFilial: "03007331012077",
        }),
      /nfeOrigem/,
    );
    assert.throws(
      () =>
        buildFulfillmentInfCplText({
          operation: "INSULCESSO_DE_ENTREGA",
          ufDestino: "SC",
          cnpjFilial: "03007331012077",
          nfeOrigem: { numero: Number.NaN, serie: 1, emitidaEm: "2026-06-17T12:00:00-03:00" },
        }),
      /nfeOrigem/,
    );
  });

  it("nao inclui acentos nem quebras de linha", () => {
    const text = buildFulfillmentInfCplText({
      operation: "REMESSA_SIMBOLICA",
      ufDestino: "BA",
      cnpjFilial: "03007331009793",
      middle: "Inscricao Estadual do Operador Logistico: 123.",
    });
    assert.doesNotMatch(text, /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/);
    assert.doesNotMatch(text, /\n/);
  });
});
