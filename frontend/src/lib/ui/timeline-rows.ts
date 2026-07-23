import type { TimelineChainDto, TimelineRemessaGroupDto } from "@/lib/fiscal-types";

/** Linha plana da timeline no layout `rows` do dashboard. */
export type FlatScenarioRow = {
  key: string;
  /** Ex.: `160/58` ou `Vendas avulsas`. */
  remessaNumeroSerie: string;
  /** Ex.: `saldo 97` — omitido em vendas avulsas. */
  saldoLabel?: string;
  cenario: TimelineChainDto | null;
  index: number;
};

/**
 * Achata grupos Remessa → cenários em linhas para o card do Dashboard.
 * Grupo sem cenários vira uma linha com `cenario: null`.
 * `index` é ordinal global (Cenário 1, 2, …) entre todos os cenários listados.
 */
export function flattenScenarioRows(groups: TimelineRemessaGroupDto[]): FlatScenarioRow[] {
  const rows: FlatScenarioRow[] = [];
  let scenarioOrdinal = 0;

  for (const group of groups) {
    const avulsa = !group.remessaChave;
    const remessaNumeroSerie = avulsa
      ? "Vendas avulsas"
      : `${group.remessaNumero}/${group.remessaSerie}`;
    const saldoLabel =
      !avulsa && group.saldoDisponivel != null ? `saldo ${group.saldoDisponivel}` : undefined;

    if (group.cenarios.length === 0) {
      rows.push({
        key: `${group.remessaChave || "avulsa"}-empty`,
        remessaNumeroSerie,
        saldoLabel,
        cenario: null,
        index: 0,
      });
      continue;
    }

    group.cenarios.forEach((cenario) => {
      scenarioOrdinal += 1;
      rows.push({
        key: cenario.id,
        remessaNumeroSerie,
        saldoLabel,
        cenario,
        index: scenarioOrdinal,
      });
    });
  }
  return rows;
}
