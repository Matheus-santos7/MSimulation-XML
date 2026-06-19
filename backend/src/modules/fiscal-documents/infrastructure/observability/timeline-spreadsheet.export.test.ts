import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FiscalStatus, NFeTipo } from "../../../../generated/prisma/client.js";
import type { TimelineRemessaGroupDto } from "./timeline-step.dto.js";
import { buildTimelineSpreadsheetExportData, buildTimelineSpreadsheetRows } from "./timeline-spreadsheet.export.js";

describe("buildTimelineSpreadsheetRows", () => {
  const groups: TimelineRemessaGroupDto[] = [
    {
      remessaChave: "rem-1",
      remessaNumero: 8,
      remessaSerie: 58,
      emitidaEm: "2026-01-01T00:00:00.000Z",
      quantidadeRemessa: 10,
      saldoDisponivel: 5,
      cenarios: [
        {
          id: "c1",
          pedidoMl: "ML-123",
          emitidaEm: "2026-01-02T00:00:00.000Z",
          status: "completa",
          steps: [
            {
              kind: "nfe",
              tipo: NFeTipo.REMESSA,
              tipoLabel: "Remessa",
              chave: "ch-rem",
              numero: 8,
              serie: 58,
              emitidaEm: "2026-01-01T10:00:00.000Z",
              quantidade: 10,
              status: FiscalStatus.AUTORIZADA,
            },
            {
              kind: "event",
              eventTipo: "INUT",
              eventId: "inut-1",
              eventLabel: "Inutilização",
              serie: 58,
              numero: 11,
              numeroFim: 12,
              ocorridoEm: "2026-01-01T11:00:00.000Z",
            },
            {
              kind: "nfe",
              tipo: NFeTipo.VENDA,
              tipoLabel: "Venda",
              chave: "ch-venda",
              numero: 14,
              serie: 58,
              emitidaEm: "2026-01-02T10:00:00.000Z",
              quantidade: 1,
              status: FiscalStatus.CANCELADA,
              nfeReferenciaChave: "ch-ret",
            },
            {
              kind: "event",
              eventTipo: "110111",
              eventId: "evt-1",
              eventLabel: "Cancelamento",
              serie: 58,
              numero: 14,
              ocorridoEm: "2026-01-02T11:00:00.000Z",
              chaveRef: "ch-venda",
            },
          ],
        },
      ],
    },
  ];

  const nfeDetails = new Map([
    [
      "ch-rem",
      { cfop: "5904", destUf: "SP", produto: "300002137", nfeReferenciaChave: undefined },
    ],
    [
      "ch-venda",
      { cfop: "6108", destUf: "RJ", produto: "300002137", nfeReferenciaChave: "ch-ret" },
    ],
  ]);

  it("gera uma linha por passo do cenário com colunas fiscais", () => {
    const rows = buildTimelineSpreadsheetRows(groups, "SP", nfeDetails);

    assert.equal(rows.length, 4);
    assert.equal(rows[0]?.CENÁRIO, "Cenário 1");
    assert.equal(rows[0]?.TIPO, "Remessa");
    assert.equal(rows[0]?.CFOP, "5904");
    assert.equal(rows[0]?.PRODUTO, "300002137");

    assert.equal(rows[1]?.TIPO, "Inutilização");
    assert.equal(rows[1]?.["NF-e/SÉRIE"], "11–12/58");
    assert.equal(rows[1]?.["CHAVE DE ACESSO"], "");

    assert.equal(rows[2]?.TIPO, "Venda");
    assert.equal(rows[2]?.["UF DEST"], "RJ");
    assert.equal(rows[2]?.["CHAVE REF"], "ch-ret");

    assert.equal(rows[3]?.TIPO, "Cancelamento");
    assert.equal(rows[3]?.["CHAVE DE ACESSO"], "ch-venda");
  });

  it("marca todas as linhas do mesmo cenário com o mesmo índice de faixa", () => {
    const exportData = buildTimelineSpreadsheetExportData(groups, "SP", nfeDetails);

    assert.equal(exportData.length, 4);
    assert.equal(exportData[0]?.scenarioStripe, 0);
    assert.equal(exportData[1]?.scenarioStripe, 0);
    assert.equal(exportData[2]?.scenarioStripe, 0);
    assert.equal(exportData[3]?.scenarioStripe, 0);
  });

  it("alterna faixa entre cenários diferentes", () => {
    const groupsWithTwoScenarios: TimelineRemessaGroupDto[] = [
      {
        ...groups[0]!,
        cenarios: [
          groups[0]!.cenarios[0]!,
          {
            id: "c2",
            pedidoMl: "ML-456",
            emitidaEm: "2026-01-03T00:00:00.000Z",
            status: "parcial",
            steps: [
              {
                kind: "nfe",
                tipo: NFeTipo.VENDA,
                tipoLabel: "Venda",
                chave: "ch-venda-2",
                numero: 15,
                serie: 58,
                emitidaEm: "2026-01-03T10:00:00.000Z",
                quantidade: 1,
                status: FiscalStatus.AUTORIZADA,
              },
            ],
          },
        ],
      },
    ];

    const exportData = buildTimelineSpreadsheetExportData(groupsWithTwoScenarios, "SP", nfeDetails);

    assert.equal(exportData[0]?.scenarioStripe, 0);
    assert.equal(exportData[3]?.scenarioStripe, 0);
    assert.equal(exportData[4]?.scenarioStripe, 1);
  });
});
