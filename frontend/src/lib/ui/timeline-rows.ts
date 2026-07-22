import type { TimelineChainDto, TimelineRemessaGroupDto } from "@/lib/fiscal-types";

/** Linha plana da timeline no layout `rows` do dashboard. */
export type FlatScenarioRow = {
  key: string;
  remessaLabel: string;
  remessaMeta?: string;
  cenario: TimelineChainDto | null;
  index: number;
};

/**
 * Achata grupos Remessa → cenários em linhas para o card do Dashboard.
 * Grupo sem cenários vira uma linha com `cenario: null`.
 */
export function flattenScenarioRows(groups: TimelineRemessaGroupDto[]): FlatScenarioRow[] {
  const rows: FlatScenarioRow[] = [];
  for (const group of groups) {
    const avulsa = !group.remessaChave;
    const remessaLabel = avulsa
      ? "Vendas avulsas"
      : `Remessa ${group.remessaNumero}/${group.remessaSerie}`;
    const remessaMeta = avulsa
      ? undefined
      : [
          `${group.quantidadeRemessa} und`,
          group.saldoDisponivel != null ? `saldo ${group.saldoDisponivel}` : null,
        ]
          .filter(Boolean)
          .join(" · ");

    if (group.cenarios.length === 0) {
      rows.push({
        key: `${group.remessaChave || "avulsa"}-empty`,
        remessaLabel,
        remessaMeta,
        cenario: null,
        index: 0,
      });
      continue;
    }

    group.cenarios.forEach((cenario, i) => {
      rows.push({
        key: cenario.id,
        remessaLabel,
        remessaMeta,
        cenario,
        index: i + 1,
      });
    });
  }
  return rows;
}
