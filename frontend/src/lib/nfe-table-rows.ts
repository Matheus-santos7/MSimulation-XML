import type { FiscalEventDto, NFeDto } from "./fiscal-types";

export type NfeTableRow =
  | { kind: "nfe"; sortSerie: number; sortNumero: number; nfe: NFeDto }
  | { kind: "inut"; sortSerie: number; sortNumero: number; inut: FiscalEventDto };

export function buildNfeTableRows(nfes: NFeDto[], eventos: FiscalEventDto[]): NfeTableRow[] {
  const inuts = eventos.filter((e) => e.tipo === "INUT" && e.serie != null && e.numeroIni != null);

  const rows: NfeTableRow[] = [
    ...nfes.map((nfe) => ({
      kind: "nfe" as const,
      sortSerie: nfe.serie,
      sortNumero: nfe.numero,
      nfe,
    })),
    ...inuts.map((inut) => ({
      kind: "inut" as const,
      sortSerie: inut.serie!,
      sortNumero: inut.numeroIni!,
      inut,
    })),
  ];

  return rows.sort((a, b) => {
    if (a.sortSerie !== b.sortSerie) return a.sortSerie - b.sortSerie;
    return a.sortNumero - b.sortNumero;
  });
}

export function formatNumeroSerie(serie: number, numeroIni: number, numeroFim?: number): string {
  if (numeroFim != null && numeroFim !== numeroIni) {
    return `${numeroIni}–${numeroFim} / ${serie}`;
  }
  return `${numeroIni} / ${serie}`;
}
