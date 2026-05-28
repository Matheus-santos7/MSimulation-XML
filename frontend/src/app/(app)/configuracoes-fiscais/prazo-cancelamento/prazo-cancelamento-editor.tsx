"use client";

import { useState } from "react";
import { FiscalSettingsCard, FiscalSettingsScreenLayout } from "@/components/fiscal-settings/screen-layout";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FiscalEmitterSettingsData } from "@/lib/fiscal-emitter-settings-types";

export function PrazoCancelamentoEditor({
  initial,
}: {
  initial: FiscalEmitterSettingsData["nfe"]["prazoCancelamento"];
}) {
  const [horas, setHoras] = useState(String(initial.horas));
  const [naoInformar, setNaoInformar] = useState(initial.naoInformar);

  return (
    <FiscalSettingsScreenLayout
      title="Prazo para cancelamento de NF-e"
      description="Informe em até quantas horas suas NF-e podem ser canceladas e consulte as regras do seu estado. Após o prazo, será necessária nota de devolução."
      breadcrumb="Prazo de Cancelamento"
      onSave={() => {
        const h = Math.min(1440, Math.max(1, Number(horas) || 24));
        return {
          nfe: {
            prazoCancelamento: {
              horas: naoInformar ? 24 : h,
              naoInformar,
            },
          },
        };
      }}
    >
      <FiscalSettingsCard className="p-6">
        <div className="space-y-3">
          <Label htmlFor="horas">Informe o prazo em horas</Label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              id="horas"
              type="number"
              min={1}
              max={1440}
              disabled={naoInformar}
              value={horas}
              onChange={(e) => setHoras(e.target.value)}
              className="max-w-xs"
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={naoInformar} onCheckedChange={(c) => setNaoInformar(c === true)} />
              Não informar
            </label>
          </div>
          <p className="text-[13px] text-muted-foreground">Deve ser entre 1 e 1440 horas</p>
        </div>
      </FiscalSettingsCard>
    </FiscalSettingsScreenLayout>
  );
}
