"use client";

import { FiscalSettingsFormShell } from "@/components/fiscal-settings-form";
import { Label } from "@/components/ui/label";

export function FormaFaturamentoForm({
  initial,
}: {
  initial: "EMISSOR_PROPRIO" | "EMISSOR_ML";
}) {
  return (
    <FiscalSettingsFormShell
      title="Forma de Faturamento"
      onSave={() => {
        const el = document.getElementById("forma") as HTMLSelectElement;
        return {
          basic: {
            formaFaturamento: el.value as "EMISSOR_PROPRIO" | "EMISSOR_ML",
          },
        };
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="forma">Como as notas serão emitidas</Label>
        <select
          id="forma"
          name="forma"
          defaultValue={initial}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="EMISSOR_PROPRIO">Emissor próprio</option>
          <option value="EMISSOR_ML">Emissor do Mercado Livre</option>
        </select>
      </div>
    </FiscalSettingsFormShell>
  );
}
