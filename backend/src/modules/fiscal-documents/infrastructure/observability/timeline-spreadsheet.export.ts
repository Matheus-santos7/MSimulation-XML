import XLSX from "xlsx-js-style";
import type {
  TimelineChainStepDto,
  TimelineRemessaGroupDto,
} from "./timeline-step.dto.js";

export const TIMELINE_SPREADSHEET_HEADERS = [
  "CENÁRIO",
  "DATA",
  "TIPO",
  "NF-e/SÉRIE",
  "CHAVE DE ACESSO",
  "CHAVE REF",
  "UF EMITENTE",
  "UF DEST",
  "CFOP",
  "PRODUTO",
] as const;

export type TimelineNfeExportDetail = {
  cfop: string;
  destUf: string;
  nfeReferenciaChave?: string;
  /** SKU do produto — valor da coluna PRODUTO na planilha. */
  produto: string;
};

export type TimelineSpreadsheetRow = Record<(typeof TIMELINE_SPREADSHEET_HEADERS)[number], string>;

/** Linha da planilha com metadado de faixa zebrada por cenário. */
export type TimelineSpreadsheetDataRow = {
  row: TimelineSpreadsheetRow;
  /** Índice do cenário na ordem da planilha — usado para faixas zebradas. */
  scenarioStripe: number;
};

const HEADER_FILL = { patternType: "solid" as const, fgColor: { rgb: "FFE5E7EB" } };
const ROW_FILL_EVEN = { patternType: "solid" as const, fgColor: { rgb: "FFFFFFFF" } };
const ROW_FILL_ODD = { patternType: "solid" as const, fgColor: { rgb: "FFF3F4F6" } };

function formatSpreadsheetDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatNfeSerie(numero: number, serie: number, numeroFim?: number): string {
  if (numeroFim != null && numeroFim !== numero) {
    return `${numero}–${numeroFim}/${serie}`;
  }
  return `${numero}/${serie}`;
}

function mapNfeStepRow(
  context: {
    cenario: string;
    ufEmitente: string;
  },
  step: Extract<TimelineChainStepDto, { kind: "nfe" }>,
  nfeDetails: Map<string, TimelineNfeExportDetail>,
): TimelineSpreadsheetRow {
  const detail = nfeDetails.get(step.chave);
  const chaveRef = step.nfeReferenciaChave ?? detail?.nfeReferenciaChave ?? "";

  return {
    CENÁRIO: context.cenario,
    DATA: formatSpreadsheetDate(step.emitidaEm),
    TIPO: step.tipoLabel,
    "NF-e/SÉRIE": formatNfeSerie(step.numero, step.serie),
    "CHAVE DE ACESSO": step.chave,
    "CHAVE REF": chaveRef,
    "UF EMITENTE": context.ufEmitente,
    "UF DEST": detail?.destUf ?? "",
    CFOP: detail?.cfop ?? "",
    PRODUTO: detail?.produto ?? "",
  };
}

function mapEventStepRow(
  context: {
    cenario: string;
    ufEmitente: string;
  },
  step: Extract<TimelineChainStepDto, { kind: "event" }>,
): TimelineSpreadsheetRow {
  return {
    CENÁRIO: context.cenario,
    DATA: formatSpreadsheetDate(step.ocorridoEm),
    TIPO: step.eventLabel,
    "NF-e/SÉRIE": formatNfeSerie(step.numero, step.serie, step.numeroFim),
    "CHAVE DE ACESSO": step.eventTipo === "110111" ? (step.chaveRef ?? "") : "",
    "CHAVE REF": step.chaveRef ?? "",
    "UF EMITENTE": context.ufEmitente,
    "UF DEST": "",
    CFOP: "",
    PRODUTO: "",
  };
}

/**
 * Converte grupos da timeline em linhas tabulares para exportação em planilha.
 * Cada passo (NF-e ou evento) vira uma linha; o índice `scenarioStripe` incrementa
 * a cada cenário para permitir faixas zebradas no XLSX.
 *
 * @param groups - Timeline agrupada por remessa (`listTimelineChains`).
 * @param ufEmitente - UF do tenant (coluna UF EMITENTE).
 * @param nfeDetails - Metadados fiscais indexados por chave de NF-e.
 * @returns Linhas com valores e índice de faixa por cenário.
 */
export function buildTimelineSpreadsheetExportData(
  groups: TimelineRemessaGroupDto[],
  ufEmitente: string,
  nfeDetails: Map<string, TimelineNfeExportDetail>,
): TimelineSpreadsheetDataRow[] {
  const rows: TimelineSpreadsheetDataRow[] = [];
  let scenarioStripe = 0;

  for (const group of groups) {
    group.cenarios.forEach((cenario, index) => {
      const context = {
        cenario: `Cenário ${index + 1}`,
        ufEmitente,
      };

      for (const step of cenario.steps) {
        const row =
          step.kind === "event"
            ? mapEventStepRow(context, step)
            : mapNfeStepRow(context, step, nfeDetails);
        rows.push({ row, scenarioStripe });
      }

      scenarioStripe += 1;
    });
  }

  return rows;
}

export function buildTimelineSpreadsheetRows(
  groups: TimelineRemessaGroupDto[],
  ufEmitente: string,
  nfeDetails: Map<string, TimelineNfeExportDetail>,
): TimelineSpreadsheetRow[] {
  return buildTimelineSpreadsheetExportData(groups, ufEmitente, nfeDetails).map((entry) => entry.row);
}

function rowToArray(row: TimelineSpreadsheetRow): string[] {
  return TIMELINE_SPREADSHEET_HEADERS.map((header) => row[header]);
}

function applyScenarioStripes(worksheet: XLSX.WorkSheet, dataRows: TimelineSpreadsheetDataRow[]): void {
  const colCount = TIMELINE_SPREADSHEET_HEADERS.length;

  for (let col = 0; col < colCount; col += 1) {
    const headerRef = XLSX.utils.encode_cell({ r: 0, c: col });
    const headerCell = worksheet[headerRef];
    if (!headerCell) continue;
    headerCell.s = {
      fill: HEADER_FILL,
      font: { bold: true, color: { rgb: "FF111827" } },
      alignment: { vertical: "center", horizontal: "center" },
    };
  }

  for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex += 1) {
    const fill = dataRows[rowIndex]!.scenarioStripe % 2 === 0 ? ROW_FILL_EVEN : ROW_FILL_ODD;
    const sheetRow = rowIndex + 1;

    for (let col = 0; col < colCount; col += 1) {
      const cellRef = XLSX.utils.encode_cell({ r: sheetRow, c: col });
      const cell = worksheet[cellRef];
      if (!cell) continue;
      cell.s = {
        fill,
        alignment: { vertical: "center" },
      };
    }
  }

  worksheet["!cols"] = [
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 48 },
    { wch: 48 },
    { wch: 12 },
    { wch: 10 },
    { wch: 8 },
    { wch: 16 },
  ];
}

/**
 * Gera buffer XLSX com todos os cenários fiscais, incluindo formatação zebrada
 * alternada por cenário (tom claro) e cabeçalho destacado.
 *
 * @param groups - Timeline agrupada por remessa.
 * @param ufEmitente - UF do emitente.
 * @param nfeDetails - Detalhes fiscais por chave de NF-e.
 * @returns Buffer `.xlsx` da aba "Cenários".
 */
export function buildTimelineSpreadsheetXlsx(
  groups: TimelineRemessaGroupDto[],
  ufEmitente: string,
  nfeDetails: Map<string, TimelineNfeExportDetail>,
): Buffer {
  const dataRows = buildTimelineSpreadsheetExportData(groups, ufEmitente, nfeDetails);
  const matrix = [TIMELINE_SPREADSHEET_HEADERS.slice(), ...dataRows.map((entry) => rowToArray(entry.row))];
  const worksheet = XLSX.utils.aoa_to_sheet(matrix);
  applyScenarioStripes(worksheet, dataRows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Cenários");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}
