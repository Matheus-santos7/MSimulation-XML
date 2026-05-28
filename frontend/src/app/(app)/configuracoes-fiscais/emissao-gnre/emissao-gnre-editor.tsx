"use client";

import { useState } from "react";
import { FiscalSettingsCard, FiscalSettingsScreenLayout } from "@/components/fiscal-settings/screen-layout";
import { Checkbox } from "@/components/ui/checkbox";
import { BR_STATES } from "@/lib/fiscal-settings-constants";
import type { FiscalEmitterSettingsData } from "@/lib/fiscal-emitter-settings-types";

export function EmissaoGnreEditor({
  initial,
}: {
  initial: FiscalEmitterSettingsData["taxes"]["emissaoGnre"];
}) {
  const [estadosComIe, setEstadosComIe] = useState<string[]>(initial.estadosComIe);

  function toggle(uf: string) {
    setEstadosComIe((prev) =>
      prev.includes(uf) ? prev.filter((u) => u !== uf) : [...prev, uf].sort(),
    );
  }

  return (
    <FiscalSettingsScreenLayout
      wide
      title="Emissão da GNRE"
      description="Marque os estados em que sua empresa possui inscrição estadual na matriz para emissão de GNRE quando aplicável."
      breadcrumb="Emissão da GNRE"
      onSave={() => ({
        taxes: {
          emissaoGnre: {
            mode: estadosComIe.length > 0 ? "CUSTOM" : "DEFAULT",
            estadosComIe,
            estadosIeCount: estadosComIe.length,
          },
        },
      })}
    >
      <FiscalSettingsCard className="p-4">
        <p className="mb-3 px-2 text-sm text-muted-foreground">
          {estadosComIe.length} estado(s) selecionado(s)
        </p>
        <div className="grid gap-1 sm:grid-cols-2">
          {BR_STATES.map(({ uf, nome }) => (
            <label
              key={uf}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/50"
            >
              <Checkbox checked={estadosComIe.includes(uf)} onCheckedChange={() => toggle(uf)} />
              <span className="text-sm">
                <span className="font-mono text-muted-foreground">{uf}</span> — {nome}
              </span>
            </label>
          ))}
        </div>
      </FiscalSettingsCard>
    </FiscalSettingsScreenLayout>
  );
}
