import type { Metadata } from "next";
import { Fragment } from "react";
import { PageHeader } from "@/components/fiscal-ui";
import { TaxRuleImportForm } from "@/components/tax-rule-import-form";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { isAdminRole } from "@/lib/auth/roles";
import { getAuthMe } from "@/lib/auth/session";
import { listTaxRules } from "@/lib/fiscal-api";
import { BRAZILIAN_UFS } from "@/lib/brazilian-states";
import {
  TAX_RULES_STICKY_LEFT,
  TAX_RULES_STICKY_TOTAL,
  TAX_RULES_STICKY_W,
  TAX_RULES_UF_FIELDS,
  asTaxRuleRecord,
  buildTaxRuleGroups,
  compareTaxRulesByContributor,
  formatTaxRuleAliquotaPercent,
  formatTaxRuleUfValue,
  shortTaxStatus,
  showTaxRuleContributorCell,
  sortTaxRuleRowsForSheetLayout,
  taxRuleUfCell,
} from "@/lib/tax-rules-sheet";

export const metadata: Metadata = { title: "Regras Tributárias" };

function CompactHeader({
  title,
  lines,
  className = "",
}: {
  title: string;
  lines: readonly [string, string?];
  className?: string;
}) {
  return (
    <span className={`inline-block leading-tight normal-case ${className}`} title={title}>
      <span className="block">{lines[0]}</span>
      {lines[1] ? <span className="block text-muted-foreground">{lines[1]}</span> : null}
    </span>
  );
}

export default async function RegrasPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const nomeFilterRaw = params.nome;
  const nomeFilter = Array.isArray(nomeFilterRaw) ? nomeFilterRaw[0] ?? "" : nomeFilterRaw ?? "";
  const nomeFilterNorm = nomeFilter.trim().toLowerCase();

  const tenantId =   await resolveActiveTenantId();
  const [rules, me] = await Promise.all([listTaxRules(), getAuthMe()]);
  const isAdmin = isAdminRole(me?.role);
  const filteredRules = nomeFilterNorm
    ? rules.filter((rule) => rule.nome.toLowerCase().includes(nomeFilterNorm))
    : rules;
  const sorted = [...filteredRules].sort(compareTaxRulesByContributor);
  const groups = buildTaxRuleGroups(sorted).map((g) => ({ ...g, rows: sortTaxRuleRowsForSheetLayout(g.rows) }));
  const allRuleNames = [...new Set(rules.map((rule) => rule.nome))].sort((a, b) => a.localeCompare(b));

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Regras Tributárias"
        subtitle="Visual espelhado da planilha: regra agrupada por tipo de destinatário e colunas por UF"
      />
      <TaxRuleImportForm rulesCount={rules.length} isAdmin={isAdmin} />
      <form className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-card p-3" method="get">
        <div className="space-y-1">
          <label htmlFor="nome" className="text-xs font-medium text-muted-foreground">
            Filtrar por nome da regra
          </label>
          <input
            id="nome"
            name="nome"
            list="regras-nomes"
            defaultValue={nomeFilter}
            placeholder="Ex.: Nacional-Fogões C/Grill"
            className="h-9 w-[320px] rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          <datalist id="regras-nomes">
            {allRuleNames.map((nome) => (
              <option key={nome} value={nome} />
            ))}
          </datalist>
        </div>
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Filtrar
        </button>
        <a
          href="/regras"
          className="h-9 rounded-md border border-input px-3 text-sm font-medium text-foreground inline-flex items-center hover:bg-muted/40"
        >
          Limpar
        </a>
      </form>
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {groups.length === 0 ? (
          <div className="p-6 text-muted-foreground">Nenhuma regra cadastrada para o tenant.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-left border-separate border-spacing-0 min-w-[9800px] w-max">
              <thead>
                <tr className="text-[11px] text-muted-foreground uppercase border-b border-border bg-muted/30">
                  <th
                    className="px-3 py-2 font-semibold border-r border-border sticky left-0 z-30 bg-muted/30 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]"
                    colSpan={3}
                    style={{ minWidth: TAX_RULES_STICKY_TOTAL, width: TAX_RULES_STICKY_TOTAL }}
                  >
                    Informações da regra
                  </th>
                  <th className="px-3 py-2 font-semibold border-r border-border" colSpan={3}>
                    IPI
                  </th>
                  <th className="px-3 py-2 font-semibold border-r border-border" colSpan={2}>
                    PIS
                  </th>
                  <th className="px-3 py-2 font-semibold border-r border-border" colSpan={2}>
                    COFINS
                  </th>
                  <th className="px-3 py-2 font-semibold border-r border-border" colSpan={3}>
                    IBS/CBS
                  </th>
                  {BRAZILIAN_UFS.map((uf) => (
                    <th key={uf} className="px-3 py-2 font-semibold border-r border-border" colSpan={TAX_RULES_UF_FIELDS.length}>
                      {`(${uf}) ${uf === "DF" ? "DISTRITO FEDERAL" : ""}`.trim()}
                    </th>
                  ))}
                </tr>
                <tr className="text-[11px] text-muted-foreground uppercase border-b border-border bg-card">
                  <th
                    className="px-3 py-2 font-semibold border-r border-border sticky left-0 z-30 bg-card min-w-[220px] w-[220px] max-w-[220px]"
                  >
                    Nome da regra
                  </th>
                  <th
                    className="px-3 py-2 font-semibold border-r border-border sticky z-30 bg-card min-w-[72px] w-[72px] max-w-[72px]"
                    style={{ left: TAX_RULES_STICKY_LEFT.origem }}
                  >
                    Origem Fiscal
                  </th>
                  <th
                    className="px-2 py-1.5 text-[10px] font-semibold border-r border-border sticky z-30 bg-card min-w-[200px] w-[200px] max-w-[200px] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)] align-bottom"
                    style={{ left: TAX_RULES_STICKY_LEFT.destinatario }}
                  >
                    <CompactHeader title="Tipo de destinatário" lines={["Tipo de", "destinatário"]} />
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold align-bottom max-w-[88px]">
                    <CompactHeader title="Situação Tributária do IPI" lines={["ST", "IPI"]} />
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold align-bottom max-w-[72px]">
                    <CompactHeader title="Alíquota de IPI (%)" lines={["Alíq.", "IPI %"]} />
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold border-r border-border align-bottom max-w-[72px]">
                    <CompactHeader title="Código Enquadramento legal IPI" lines={["cEnq", "IPI"]} />
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold align-bottom max-w-[88px]">
                    <CompactHeader title="Situação Tributária do PIS" lines={["ST", "PIS"]} />
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold border-r border-border align-bottom max-w-[72px]">
                    <CompactHeader title="Alíquota de PIS (%)" lines={["Alíq.", "PIS %"]} />
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold align-bottom max-w-[88px]">
                    <CompactHeader title="Situação Tributária do COFINS" lines={["ST", "COFINS"]} />
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold border-r border-border align-bottom max-w-[72px]">
                    <CompactHeader title="Alíquota de COFINS (%)" lines={["Alíq.", "COFINS %"]} />
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold align-bottom max-w-[88px]">
                    <CompactHeader title="Situação Tributária IBS/CBS" lines={["ST", "IBS/CBS"]} />
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold align-bottom max-w-[88px]">
                    <CompactHeader title="cClassTrib IBS/CBS" lines={["cClassTrib", "IBS/CBS"]} />
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold border-r border-border align-bottom max-w-[72px]">
                    <CompactHeader title="Redução CBS (%)" lines={["Red.", "CBS %"]} />
                  </th>
                  {BRAZILIAN_UFS.map((uf) => (
                    <Fragment key={`h-${uf}`}>
                      {TAX_RULES_UF_FIELDS.map((f, idx) => (
                        <th
                          key={`${uf}-${f.suffix}`}
                          className={`px-1.5 py-1.5 text-[10px] font-semibold align-bottom max-w-[84px] w-[84px] whitespace-normal ${idx === TAX_RULES_UF_FIELDS.length - 1 ? "border-r border-border" : ""}`}
                        >
                          <CompactHeader title={f.label} lines={f.short} />
                        </th>
                      ))}
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) =>
                  group.rows.map((r, idx) => {
                    const payload = asTaxRuleRecord(r.payload);
                    const taxes = asTaxRuleRecord(payload.taxes);
                    const ipi = asTaxRuleRecord(taxes.ipi);
                    const pis = asTaxRuleRecord(taxes.pis);
                    const cofins = asTaxRuleRecord(taxes.cofins);
                    const ibsCbs = asTaxRuleRecord(taxes.ibsCbs);
                    const icmsByUf = asTaxRuleRecord(payload.icmsByUf);
                    const isFirst = idx === 0;

                    return (
                      <tr
                        key={`${group.groupId}-${idx}`}
                        className="group border-b border-border hover:bg-muted/20 transition-colors"
                      >
                        {isFirst && (
                          <td
                            className="px-3 py-2 text-[13px] font-semibold border-r border-border sticky left-0 z-10 bg-card align-middle min-w-[220px] w-[220px] max-w-[220px] group-hover:bg-muted/20"
                            rowSpan={group.rows.length}
                          >
                            <span className="min-w-0">{group.nome}</span>
                          </td>
                        )}
                        {isFirst && (
                          <td
                            className="px-3 py-2 text-[13px] font-semibold border-r border-border sticky z-10 bg-card align-middle text-center min-w-[72px] w-[72px] max-w-[72px] group-hover:bg-muted/20"
                            rowSpan={group.rows.length}
                            style={{ left: TAX_RULES_STICKY_LEFT.origem }}
                          >
                            {group.origin}
                          </td>
                        )}
                        <td
                          className="px-2 py-2 text-[12px] border-r border-border sticky z-10 bg-card text-center text-muted-foreground min-w-[200px] w-[200px] max-w-[200px] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)] group-hover:bg-muted/20"
                          style={{ left: TAX_RULES_STICKY_LEFT.destinatario }}
                        >
                          {showTaxRuleContributorCell(r)}
                        </td>

                        <td className="px-3 py-2 text-[12px]">{shortTaxStatus(ipi.st)}</td>
                        <td className="px-3 py-2 text-[12px] font-mono text-right">{formatTaxRuleAliquotaPercent(ipi.aliquota, 2)}</td>
                        <td className="px-3 py-2 text-[12px] font-mono text-center border-r border-border">{shortTaxStatus(ipi.codEnq)}</td>

                        <td className="px-3 py-2 text-[12px]">{shortTaxStatus(pis.st)}</td>
                        <td className="px-3 py-2 text-[12px] font-mono text-right border-r border-border">{formatTaxRuleAliquotaPercent(pis.aliquota, 2)}</td>

                        <td className="px-3 py-2 text-[12px]">{shortTaxStatus(cofins.st)}</td>
                        <td className="px-3 py-2 text-[12px] font-mono text-right border-r border-border">{formatTaxRuleAliquotaPercent(cofins.aliquota, 2)}</td>

                        <td className="px-3 py-2 text-[12px]">{shortTaxStatus(ibsCbs.st)}</td>
                        <td className="px-3 py-2 text-[12px]">{shortTaxStatus(ibsCbs.cClassTrib)}</td>
                        <td className="px-3 py-2 text-[12px] font-mono text-right border-r border-border">{formatTaxRuleAliquotaPercent(ibsCbs.reducao, 2)}</td>

                        {BRAZILIAN_UFS.map((uf) => (
                          <Fragment key={`${group.groupId}-${idx}-${uf}`}>
                            {TAX_RULES_UF_FIELDS.map((f, fIdx) => (
                              <td
                                key={`${group.groupId}-${idx}-${uf}-${f.suffix}`}
                                className={`px-3 py-2 text-[12px] font-mono ${fIdx === TAX_RULES_UF_FIELDS.length - 1 ? "border-r border-border" : ""}`}
                              >
                                {formatTaxRuleUfValue(f.suffix, taxRuleUfCell(icmsByUf, uf, f.suffix))}
                              </td>
                            ))}
                          </Fragment>
                        ))}
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
