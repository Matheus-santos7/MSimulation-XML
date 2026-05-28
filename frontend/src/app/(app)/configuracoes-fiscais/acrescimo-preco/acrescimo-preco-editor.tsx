"use client";

import { useState } from "react";
import { FiscalInfoBanner, FiscalSettingsCard, FiscalSettingsScreenLayout } from "@/components/fiscal-settings/screen-layout";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AcrescimoPrecoEditor({ initial }: { initial: boolean }) {
  const [incluir, setIncluir] = useState(initial ? "sim" : "nao");

  return (
    <FiscalSettingsScreenLayout
      title="Acréscimo no preço do produto"
      description="Define se acréscimos no preço do produto entram no valor informado na NF-e e na composição da base de cálculo."
      breadcrumb="Acréscimo no preço do produto"
      onSave={() => ({
        nfe: { acrescimoPrecoProduto: incluir === "sim" },
      })}
    >
      <FiscalInfoBanner>
        Esta opção deve estar alinhada com a composição da base de cálculo (PIS/COFINS, ICMS e IPI) na aba correspondente.
      </FiscalInfoBanner>
      <FiscalSettingsCard className="p-6">
        <div className="space-y-2">
          <Label>Incluir acréscimo no preço do produto na NF-e?</Label>
          <Select value={incluir} onValueChange={setIncluir}>
            <SelectTrigger className="max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">Sim, incluir acréscimo no preço do produto na NF-e</SelectItem>
              <SelectItem value="nao">Não, não incluir acréscimo no preço do produto na NF-e</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </FiscalSettingsCard>
    </FiscalSettingsScreenLayout>
  );
}
