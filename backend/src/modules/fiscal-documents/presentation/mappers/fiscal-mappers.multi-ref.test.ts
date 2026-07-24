import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapNfe } from "./fiscal-mappers.js";

const baseRow = {
  id: "n1",
  tenantId: "t1",
  productId: null as string | null,
  chave: "35260701490698006689550580000002011461004890",
  numero: 201,
  serie: 58,
  natOp: "Retorno",
  cfop: "1949",
  ncm: "73211100",
  destNome: "CD",
  destDoc: "03007331012077",
  destUf: "SC",
  destIndIeDest: 1,
  destLogradouro: "Rua",
  destNumero: "1",
  destComplemento: null as string | null,
  destBairro: "Centro",
  destCodigoMunicipio: "4205407",
  destMunicipio: "Floripa",
  destCep: "88010000",
  destCodigoPais: 1058,
  destNomePais: "Brasil",
  destTelefone: null as string | null,
  valor: 100,
  valorIcms: 0,
  aliqIcms: 0,
  status: "AUTORIZADA",
  emitidaEm: new Date("2026-07-24T12:00:00-03:00"),
  pedidoMl: "PACK",
  quantidade: 2,
  tipo: "RETORNO_SIMBOLICO",
  saldoDisponivel: null as number | null,
  fiscalPayload: {},
  statusValidacao: "PENDING" as const,
  mensagemValidacao: null as string | null,
  errosValidacao: null,
  auditoriaMcp: null,
};

describe("mapNfe — multi NFref", () => {
  it("preserva nfeReferenciaChave como array para o builder XML", () => {
    const a = "35260701490698006689550580000002001461004889";
    const b = "35260701490698006689550580000002011461004890";
    const dto = mapNfe(baseRow, [a, b]);
    assert.deepEqual(dto.nfeReferenciaChave, [a, b]);
    assert.deepEqual(dto.nfeReferenciaChaves, [a, b]);
  });
});
