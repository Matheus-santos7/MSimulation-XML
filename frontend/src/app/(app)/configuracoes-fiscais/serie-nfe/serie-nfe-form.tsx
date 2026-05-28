"use client";

import { FiscalSettingsFormShell } from "@/components/fiscal-settings-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function SerieNfeForm({
  serieRemessa,
  serieCte,
}: {
  serieRemessa: number;
  serieCte: number;
}) {
  return (
    <FiscalSettingsFormShell
      title="Série da NF-e"
      onSave={() => {
        const remessa = Number((document.getElementById("serieRemessa") as HTMLInputElement).value);
        const cte = Number((document.getElementById("serieCte") as HTMLInputElement).value);
        return { serieRemessa: remessa, serieCte: cte };
      }}
    >
      <p className="text-[13px] text-muted-foreground">
        Esta série é usada em todas as NF-e do emissor: remessa, retorno simbólico, venda e devolução. O CT-e de
        remessa usa a série abaixo.
      </p>
      <div className="space-y-2">
        <Label htmlFor="serieRemessa">Série da NF-e</Label>
        <Input id="serieRemessa" name="serieRemessa" type="number" min={1} max={999} defaultValue={serieRemessa} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="serieCte">Série CT-e</Label>
        <Input id="serieCte" name="serieCte" type="number" min={1} max={999} defaultValue={serieCte} />
      </div>
    </FiscalSettingsFormShell>
  );
}
