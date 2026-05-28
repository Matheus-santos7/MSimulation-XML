"use client";

import { useMemo, useState } from "react";
import { FiscalSettingsCard, FiscalSettingsScreenLayout } from "@/components/fiscal-settings/screen-layout";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BR_STATES, DIFAL_OPCOES } from "@/lib/fiscal-settings-constants";
import type { DifalCalculo, FiscalEmitterSettingsData } from "@/lib/fiscal-emitter-settings-types";
import { Search } from "lucide-react";

export function CalculoDifalEditor({
  initial,
}: {
  initial: FiscalEmitterSettingsData["taxes"]["calculoDifal"];
}) {
  const [porUf, setPorUf] = useState(initial.porUf);
  const [bulk, setBulk] = useState<DifalCalculo>(initial.bulk);
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return BR_STATES;
    return BR_STATES.filter((s) => s.nome.toLowerCase().includes(q) || s.uf.toLowerCase().includes(q));
  }, [busca]);

  function aplicarEmMassa(val: DifalCalculo) {
    setBulk(val);
    const next = { ...porUf };
    for (const { uf } of BR_STATES) next[uf] = val;
    setPorUf(next);
  }

  return (
    <FiscalSettingsScreenLayout
      wide
      title="Cálculo DIFAL"
      description="É possível aplicar a mesma configuração em massa para todos os estados ou individualmente."
      breadcrumb="Cálculo DIFAL"
      onSave={() => ({
        taxes: {
          calculoDifal: { mode: "CUSTOM", bulk, porUf },
        },
      })}
    >
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted-foreground">Aplicar a todos:</label>
        <Select value={bulk} onValueChange={(v) => aplicarEmMassa(v as DifalCalculo)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DIFAL_OPCOES.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar estado"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      <FiscalSettingsCard>
        <div className="grid grid-cols-[1fr_minmax(14rem,18rem)] gap-px bg-border text-[13px]">
          <div className="bg-muted/60 px-4 py-2.5 font-medium text-muted-foreground">Estado</div>
          <div className="bg-muted/60 px-4 py-2.5 font-medium text-muted-foreground">Cálculo DIFAL</div>
          {filtrados.map(({ uf, nome }) => (
            <div key={uf} className="contents">
              <div className="flex items-center border-t border-border bg-card px-4 py-2.5 leading-snug">
                {nome}
              </div>
              <div className="flex items-center border-t border-border bg-card px-3 py-1.5">
                <Select
                  value={porUf[uf] ?? "PADRAO"}
                  onValueChange={(v) => setPorUf({ ...porUf, [uf]: v as DifalCalculo })}
                >
                  <SelectTrigger className="h-9 w-full border-0 bg-transparent shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFAL_OPCOES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      </FiscalSettingsCard>
    </FiscalSettingsScreenLayout>
  );
}
