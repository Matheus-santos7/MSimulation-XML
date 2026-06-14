"use client";

import { FiscalSettingsFormShell } from "@/components/fiscal-settings-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function SerieNfeForm({
  serieRemessa,
  serieTransferencia,
  serieCte,
}: {
  serieRemessa: number;
  serieTransferencia: number;
  serieCte: number;
}) {
  return (
    <FiscalSettingsFormShell
      title="Série da NF-e"
      onSave={() => {
        const remessa = Number((document.getElementById("serieRemessa") as HTMLInputElement).value);
        const transferencia = Number(
          (document.getElementById("serieTransferencia") as HTMLInputElement).value,
        );
        const cte = Number((document.getElementById("serieCte") as HTMLInputElement).value);
        return { serieRemessa: remessa, serieTransferencia: transferencia, serieCte: cte };
      }}
    >
      <p className="text-[13px] text-muted-foreground">
        A série de remessa é usada em remessa, retorno simbólico, venda e devolução. A série de transferência é usada
        na NF-e matriz → filial. O CT-e de remessa usa a série abaixo.
      </p>
      <div className="space-y-2">
        <Label htmlFor="serieRemessa">Série da NF-e (remessa / venda)</Label>
        <Input id="serieRemessa" name="serieRemessa" type="number" min={1} max={999} defaultValue={serieRemessa} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="serieTransferencia">Série transferência filial (matriz)</Label>
        <Input
          id="serieTransferencia"
          name="serieTransferencia"
          type="number"
          min={1}
          max={999}
          defaultValue={serieTransferencia}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="serieCte">Série CT-e</Label>
        <Input id="serieCte" name="serieCte" type="number" min={1} max={999} defaultValue={serieCte} />
      </div>
    </FiscalSettingsFormShell>
  );
}
