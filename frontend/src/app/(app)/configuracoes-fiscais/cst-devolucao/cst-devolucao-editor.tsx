"use client";

import { useState } from "react";
import { FiscalCodeSelect } from "@/components/fiscal-settings/fiscal-code-select";
import {
  FiscalInfoBanner,
  FiscalSettingsCard,
  FiscalSettingsScreenLayout,
} from "@/components/fiscal-settings/screen-layout";
import {
  ICMS_CST_DEVOLUCAO,
  ICMS_CST_VENDA,
  PIS_COFINS_CST_DEVOLUCAO,
  PIS_COFINS_CST_VENDA,
  labelForOption,
} from "@/lib/fiscal-settings-constants";
import type { CstDevolucaoMap, FiscalEmitterSettingsData } from "@/lib/fiscal-emitter-settings-types";

function MappingTable({
  title,
  rows,
  vendaOptions,
  devolucaoOptions,
  onChange,
}: {
  title: string;
  rows: CstDevolucaoMap[];
  vendaOptions: { value: string; label: string }[];
  devolucaoOptions: { value: string; label: string }[];
  onChange: (rows: CstDevolucaoMap[]) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>
      <FiscalSettingsCard>
        <div className="grid grid-cols-[1fr_minmax(12rem,16rem)] gap-px bg-border text-[13px]">
          <div className="bg-muted/60 px-4 py-2.5 font-medium text-muted-foreground">Nota de venda</div>
          <div className="bg-muted/60 px-4 py-2.5 font-medium text-muted-foreground">Nota de devolução</div>
          {rows.map((row, i) => (
            <div key={`${row.venda}-${i}`} className="contents">
              <div className="flex min-h-[3.25rem] items-center border-t border-border bg-card px-4 py-2 leading-snug">
                {labelForOption(vendaOptions, row.venda)}
              </div>
              <div className="flex items-center border-t border-border bg-card px-3 py-2">
                <FiscalCodeSelect
                  options={devolucaoOptions}
                  value={row.devolucao}
                  onChange={(devolucao) => {
                    const next = [...rows];
                    next[i] = { ...row, devolucao };
                    onChange(next);
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </FiscalSettingsCard>
    </section>
  );
}

export function CstDevolucaoEditor({ initial }: { initial: FiscalEmitterSettingsData["taxes"]["cstDevolucao"] }) {
  const [icms, setIcms] = useState(initial.icms);
  const [pisCofins, setPisCofins] = useState(initial.pisCofins);

  return (
    <FiscalSettingsScreenLayout
      wide
      title="CST da NF-e de devolução"
      description="Mapeie o CST da nota de venda para o CST correspondente na nota de devolução."
      breadcrumb="CST da NF-e de devolução"
      onSave={() => ({
        taxes: {
          cstDevolucao: { mode: "CUSTOM", icms, pisCofins },
        },
      })}
    >
      <FiscalInfoBanner>
        Por que existe um imposto Simples no Regime Normal? Empresas que migraram do Simples para o Normal e têm
        notas de venda emitidas como Simples devem informar o CST da nota de devolução aqui. Se isso não se aplica à
        sua empresa, mantenha os valores padrão.
      </FiscalInfoBanner>

      <MappingTable
        title="ICMS"
        rows={icms}
        vendaOptions={ICMS_CST_VENDA}
        devolucaoOptions={ICMS_CST_DEVOLUCAO}
        onChange={setIcms}
      />

      <MappingTable
        title="PIS/COFINS"
        rows={pisCofins}
        vendaOptions={PIS_COFINS_CST_VENDA}
        devolucaoOptions={PIS_COFINS_CST_DEVOLUCAO}
        onChange={setPisCofins}
      />
    </FiscalSettingsScreenLayout>
  );
}
