"use client";

import { useState } from "react";
import { FiscalSettingsCard, FiscalSettingsScreenLayout } from "@/components/fiscal-settings/screen-layout";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FiscalEmitterSettingsData } from "@/lib/fiscal-emitter-settings-types";

export function DadosAnunciosEditor({
  initial,
}: {
  initial: FiscalEmitterSettingsData["basic"];
}) {
  const [ok, setOk] = useState(initial.dadosFiscaisAnunciosOk);
  const [nota, setNota] = useState(initial.dadosFiscaisAnunciosNota ?? "");

  return (
    <FiscalSettingsScreenLayout
      title="Dados fiscais dos anúncios"
      description="Indique se NCM, origem, CEST e demais dados fiscais dos anúncios já estão configurados no catálogo."
      breadcrumb="Dados fiscais dos anúncios"
      onSave={() => ({
        basic: {
          dadosFiscaisAnunciosOk: ok,
          dadosFiscaisAnunciosNota: nota.trim(),
        },
      })}
    >
      <FiscalSettingsCard className="space-y-4 p-6">
        <label className="flex items-start gap-2 text-sm">
          <Checkbox className="mt-0.5" checked={ok} onCheckedChange={(c) => setOk(c === true)} />
          Dados fiscais dos anúncios configurados
        </label>
        <div className="space-y-2">
          <Label htmlFor="nota">Observações internas (opcional)</Label>
          <Textarea
            id="nota"
            rows={4}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ex.: pendência de NCM em 3 SKUs…"
          />
        </div>
      </FiscalSettingsCard>
    </FiscalSettingsScreenLayout>
  );
}
