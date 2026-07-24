import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CfopRoutingError,
  customerTypeToPerfilComprador,
  resolveCfopByDecisionTree,
} from "./cfop-routing.js";

describe("resolveCfopByDecisionTree", () => {
  it("prefixo 5 intra / 6 inter", () => {
    assert.equal(
      resolveCfopByDecisionTree({
        ufOrigem: "SP",
        ufDestino: "sp",
        operacaoTipo: "remessa_armazenagem",
      }).prefixo,
      "5",
    );
    assert.equal(
      resolveCfopByDecisionTree({
        ufOrigem: "SP",
        ufDestino: "MG",
        operacaoTipo: "remessa_armazenagem",
      }).prefixo,
      "6",
    );
  });

  it("remessa_armazenagem → 5905/6905", () => {
    assert.equal(
      resolveCfopByDecisionTree({
        ufOrigem: "PR",
        ufDestino: "PR",
        operacaoTipo: "remessa_armazenagem",
      }).cfop,
      "5905",
    );
    assert.equal(
      resolveCfopByDecisionTree({
        ufOrigem: "PR",
        ufDestino: "SC",
        operacaoTipo: "remessa_armazenagem",
      }).cfop,
      "6905",
    );
  });

  it("venda Full (armazem_geral) industria/comercio", () => {
    assert.equal(
      resolveCfopByDecisionTree({
        ufOrigem: "SP",
        ufDestino: "SP",
        operacaoTipo: "venda",
        logistica: "armazem_geral",
        perfilVendedor: "industria",
      }).cfop,
      "5105",
    );
    assert.equal(
      resolveCfopByDecisionTree({
        ufOrigem: "SP",
        ufDestino: "RJ",
        operacaoTipo: "venda",
        logistica: "armazem_geral",
        perfilVendedor: "industria",
      }).cfop,
      "6105",
    );
    assert.equal(
      resolveCfopByDecisionTree({
        ufOrigem: "SP",
        ufDestino: "SP",
        operacaoTipo: "venda",
        logistica: "armazem_geral",
        perfilVendedor: "comercio",
      }).cfop,
      "5106",
    );
    assert.equal(
      resolveCfopByDecisionTree({
        ufOrigem: "SP",
        ufDestino: "RJ",
        operacaoTipo: "venda",
        logistica: "armazem_geral",
        perfilVendedor: "comercio",
      }).cfop,
      "6106",
    );
  });

  it("venda estoque_proprio ST", () => {
    assert.equal(
      resolveCfopByDecisionTree({
        ufOrigem: "SP",
        ufDestino: "SP",
        operacaoTipo: "venda",
        logistica: "estoque_proprio",
        produtoSt: true,
      }).cfop,
      "5405",
    );
    assert.equal(
      resolveCfopByDecisionTree({
        ufOrigem: "SP",
        ufDestino: "MG",
        operacaoTipo: "venda",
        logistica: "estoque_proprio",
        produtoSt: true,
        stInterestadualMode: "protocolo",
      }).cfop,
      "6403",
    );
    assert.equal(
      resolveCfopByDecisionTree({
        ufOrigem: "SP",
        ufDestino: "MG",
        operacaoTipo: "venda",
        logistica: "estoque_proprio",
        produtoSt: true,
      }).cfop,
      "6404",
    );
  });

  it("venda estoque_proprio sem ST — comercio e industria", () => {
    assert.equal(
      resolveCfopByDecisionTree({
        ufOrigem: "PR",
        ufDestino: "PR",
        operacaoTipo: "venda",
        logistica: "estoque_proprio",
        perfilVendedor: "comercio",
      }).cfop,
      "5102",
    );
    assert.equal(
      resolveCfopByDecisionTree({
        ufOrigem: "PR",
        ufDestino: "SC",
        operacaoTipo: "venda",
        logistica: "estoque_proprio",
        perfilVendedor: "comercio",
        perfilComprador: "contribuinte",
      }).cfop,
      "6102",
    );
    assert.equal(
      resolveCfopByDecisionTree({
        ufOrigem: "PR",
        ufDestino: "SC",
        operacaoTipo: "venda",
        logistica: "estoque_proprio",
        perfilVendedor: "comercio",
        perfilComprador: "consumidor_final",
      }).cfop,
      "6108",
    );
    assert.equal(
      resolveCfopByDecisionTree({
        ufOrigem: "PR",
        ufDestino: "PR",
        operacaoTipo: "venda",
        logistica: "estoque_proprio",
        perfilVendedor: "industria",
      }).cfop,
      "5101",
    );
    assert.equal(
      resolveCfopByDecisionTree({
        ufOrigem: "PR",
        ufDestino: "SC",
        operacaoTipo: "venda",
        logistica: "estoque_proprio",
        perfilVendedor: "industria",
        perfilComprador: "contribuinte",
      }).cfop,
      "6101",
    );
    assert.equal(
      resolveCfopByDecisionTree({
        ufOrigem: "PR",
        ufDestino: "SC",
        operacaoTipo: "venda",
        logistica: "estoque_proprio",
        perfilVendedor: "industria",
        perfilComprador: "consumidor_final",
      }).cfop,
      "6107",
    );
  });

  it("venda sem logistica falha", () => {
    assert.throws(
      () =>
        resolveCfopByDecisionTree({
          ufOrigem: "SP",
          ufDestino: "SP",
          operacaoTipo: "venda",
        }),
      CfopRoutingError,
    );
  });
});

describe("customerTypeToPerfilComprador", () => {
  it("mapeia taxpayer/non_taxpayer", () => {
    assert.equal(customerTypeToPerfilComprador("taxpayer"), "contribuinte");
    assert.equal(customerTypeToPerfilComprador("non_taxpayer"), "consumidor_final");
  });
});
