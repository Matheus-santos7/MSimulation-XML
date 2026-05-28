"use client";

import { useState } from "react";
import { FiscalCodeSelect } from "@/components/fiscal-settings/fiscal-code-select";
import { FiscalSettingsCard, FiscalSettingsScreenLayout } from "@/components/fiscal-settings/screen-layout";
import { MOD_FRETE_OPCOES } from "@/lib/fiscal-settings-constants";
import type { FiscalEmitterSettingsData } from "@/lib/fiscal-emitter-settings-types";

type Field = {
  key: keyof FiscalEmitterSettingsData["taxes"]["modalidadeFrete"];
  section: string;
  label: string;
};

const FIELDS: Field[] = [
  { section: "Logística Fulfillment", key: "fullfilmentVendas", label: "Vendas" },
  { section: "Logística Fulfillment", key: "fullfilmentEntrada", label: "Entrada" },
  { section: "Logística de coleta", key: "coleta", label: "Coleta" },
  { section: "Logística Flex", key: "flex", label: "Flex" },
  { section: "Logística Turbo", key: "turbo", label: "Turbo" },
];

export function ModalidadeFreteEditor({
  initial,
}: {
  initial: FiscalEmitterSettingsData["taxes"]["modalidadeFrete"];
}) {
  const [state, setState] = useState(initial);

  const sections = [...new Set(FIELDS.map((f) => f.section))];

  return (
    <FiscalSettingsScreenLayout
      title="Modalidade de Frete"
      description="Selecione o método de envio que pretende incluir em todas as suas notas de vendas."
      breadcrumb="Modalidade de Frete"
      onSave={() => ({
        taxes: {
          modalidadeFrete: { ...state, mode: "CUSTOM" },
        },
      })}
    >
      <FiscalSettingsCard className="divide-y divide-border">
        {sections.map((section) => (
          <div key={section} className="space-y-0">
            <h2 className="border-b border-border bg-muted/30 px-4 py-2.5 text-sm font-semibold">{section}</h2>
            {FIELDS.filter((f) => f.section === section).map(({ key, label }) => (
              <div
                key={key}
                className="grid grid-cols-1 items-center gap-3 border-b border-border px-4 py-3 last:border-0 sm:grid-cols-[minmax(8rem,12rem)_1fr]"
              >
                <span className="text-sm text-muted-foreground">{label}</span>
                <FiscalCodeSelect
                  options={MOD_FRETE_OPCOES}
                  value={String(state[key])}
                  onChange={(v) => setState({ ...state, [key]: v })}
                />
              </div>
            ))}
          </div>
        ))}
      </FiscalSettingsCard>
    </FiscalSettingsScreenLayout>
  );
}
