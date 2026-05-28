"use client";

import { useState } from "react";
import { FiscalSettingsCard, FiscalSettingsScreenLayout } from "@/components/fiscal-settings/screen-layout";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function FreteNfeEditor({ initial }: { initial: boolean }) {
  const [valor, setValor] = useState(initial ? "sim" : "nao");

  return (
    <FiscalSettingsScreenLayout
      title="Frete de NF-e"
      description="Define se o valor do frete entra na base de cálculo da NF-e de venda."
      breadcrumb="Frete de NF-e"
      onSave={() => ({
        nfe: { freteNoCalculo: valor === "sim" },
      })}
    >
      <FiscalSettingsCard className="p-6">
        <div className="space-y-2">
          <Label>Lançar frete no cálculo da NF-e?</Label>
          <Select value={valor} onValueChange={setValor}>
            <SelectTrigger className="max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">Sim, lançar o frete no cálculo da NF-e</SelectItem>
              <SelectItem value="nao">Não lançar o frete no cálculo da NF-e</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </FiscalSettingsCard>
    </FiscalSettingsScreenLayout>
  );
}
