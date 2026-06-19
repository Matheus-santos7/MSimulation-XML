import * as XLSX from "xlsx";
import type {
  TimelineChainStepDto,
  TimelineRemessaGroupDto,
} from "./timeline-step.dto.js";

export const TIMELINE_SPREADSHEET_HEADERS = [
  "REMESSA",
  "CENÁRIO",
  "PEDIDO ML",
  "STATUS",
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
  produto: string;
};

export type TimelineSpreadsheetRow = Record<(typeof TIMELINE_SPREADSHEET_HEADERS)[number], string>;

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

function resolveRemessaLabel(group: TimelineRemessaGroupDto): string {
  if (!group.remessaChave) return "Vendas avulsas";
  if (group.remessaNumero != null && group.remessaSerie != null) {
    return `Remessa ${group.remessaNumero}/${group.remessaSerie}`;
  }
  return "Remessa";
}

function resolveCenarioStatusLabel(status: TimelineRemessaGroupDto["cenarios"][number]["status"]): string {
  if (status === "cancelada") return "Cancelada";
  if (status === "completa") return "Completa";
  return "Em aberto";
}

function mapNfeStepRow(
  context: {
    remessa: string;
    cenario: string;
    pedidoMl: string;
    statusCenario: string;
    ufEmitente: string;
  },
  step: Extract<TimelineChainStepDto, { kind: "nfe" }>,
  nfeDetails: Map<string, TimelineNfeExportDetail>,
): TimelineSpreadsheetRow {
  const detail = nfeDetails.get(step.chave);
  const chaveRef = step.nfeReferenciaChave ?? detail?.nfeReferenciaChave ?? "";

  return {
    REMESSA: context.remessa,
    CENÁRIO: context.cenario,
    "PEDIDO ML": context.pedidoMl,
    STATUS: context.statusCenario,
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
    remessa: string;
    cenario: string;
    pedidoMl: string;
    statusCenario: string;
    ufEmitente: string;
  },
  step: Extract<TimelineChainStepDto, { kind: "event" }>,
): TimelineSpreadsheetRow {
  return {
    REMESSA: context.remessa,
    CENÁRIO: context.cenario,
    "PEDIDO ML": context.pedidoMl,
    STATUS: context.statusCenario,
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
 */
export function buildTimelineSpreadsheetRows(
  groups: TimelineRemessaGroupDto[],
  ufEmitente: string,
  nfeDetails: Map<string, TimelineNfeExportDetail>,
): TimelineSpreadsheetRow[] {
  const rows: TimelineSpreadsheetRow[] = [];

  for (const group of groups) {
    const remessa = resolveRemessaLabel(group);

    group.cenarios.forEach((cenario, index) => {
      const context = {
        remessa,
        cenario: `Cenário ${index + 1}`,
        pedidoMl: cenario.pedidoMl ?? "",
        statusCenario: resolveCenarioStatusLabel(cenario.status),
        ufEmitente,
      };

      for (const step of cenario.steps) {
        if (step.kind === "event") {
          rows.push(mapEventStepRow(context, step));
          continue;
        }
        rows.push(mapNfeStepRow(context, step, nfeDetails));
      }
    });
  }

  return rows;
}

function rowToArray(row: TimelineSpreadsheetRow): string[] {
  return TIMELINE_SPREADSHEET_HEADERS.map((header) => row[header]);
}

/**
 * Gera buffer XLSX com todos os cenários fiscais do tenant.
 */
export function buildTimelineSpreadsheetXlsx(
  groups: TimelineRemessaGroupDto[],
  ufEmitente: string,
  nfeDetails: Map<string, TimelineNfeExportDetail>,
): Buffer {
  const rows = buildTimelineSpreadsheetRows(groups, ufEmitente, nfeDetails);
  const matrix = [TIMELINE_SPREADSHEET_HEADERS.slice(), ...rows.map(rowToArray)];
  const worksheet = XLSX.utils.aoa_to_sheet(matrix);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Cenários");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}
