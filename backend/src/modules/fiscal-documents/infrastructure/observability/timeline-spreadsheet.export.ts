import ExcelJS from "exceljs";
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

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE5E7EB" },
};
const ROW_FILL_EVEN: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFFFFF" },
};
const ROW_FILL_ODD: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF3F4F6" },
};

const COLUMN_WIDTHS = [12, 18, 18, 14, 48, 48, 12, 10, 8, 16] as const;

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

function applyHeaderStyle(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = { bold: true, color: { argb: "FF111827" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
}

function applyDataRowStyle(row: ExcelJS.Row, scenarioStripe: number): void {
  const fill = scenarioStripe % 2 === 0 ? ROW_FILL_EVEN : ROW_FILL_ODD;
  row.eachCell((cell) => {
    cell.fill = fill;
    cell.alignment = { vertical: "middle" };
  });
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
export async function buildTimelineSpreadsheetXlsx(
  groups: TimelineRemessaGroupDto[],
  ufEmitente: string,
  nfeDetails: Map<string, TimelineNfeExportDetail>,
): Promise<Buffer> {
  const dataRows = buildTimelineSpreadsheetExportData(groups, ufEmitente, nfeDetails);
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Cenários");

  worksheet.columns = COLUMN_WIDTHS.map((width) => ({ width }));

  const headerRow = worksheet.addRow(TIMELINE_SPREADSHEET_HEADERS.slice());
  applyHeaderStyle(headerRow);

  for (const entry of dataRows) {
    const row = worksheet.addRow(rowToArray(entry.row));
    applyDataRowStyle(row, entry.scenarioStripe);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
