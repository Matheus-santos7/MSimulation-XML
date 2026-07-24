"use client";

import { FiscalSettingsFormShell } from "@/components/fiscal-settings-form";
import { Label } from "@/components/ui/label";
import type { FiscalEmitterSettingsData } from "@/lib/fiscal-emitter-settings-types";

type BasicSettings = FiscalEmitterSettingsData["basic"];

export function FormaFaturamentoForm({ initial }: { initial: BasicSettings }) {
  return (
    <FiscalSettingsFormShell
      title="Forma de Faturamento e CFOP"
      onSave={() => {
        const forma = document.getElementById("forma") as HTMLSelectElement;
        const perfil = document.getElementById("perfilVendedor") as HTMLSelectElement;
        const logistica = document.getElementById("logisticaPadrao") as HTMLSelectElement;
        const stMode = document.getElementById("stInterestadualMode") as HTMLSelectElement;
        const retornoNat = document.getElementById("retornoSimbolicoNatureza") as HTMLSelectElement;
        return {
          basic: {
            formaFaturamento: forma.value as BasicSettings["formaFaturamento"],
            perfilVendedor: perfil.value as NonNullable<BasicSettings["perfilVendedor"]>,
            logisticaPadrao: logistica.value as NonNullable<BasicSettings["logisticaPadrao"]>,
            stInterestadualMode: stMode.value as NonNullable<BasicSettings["stInterestadualMode"]>,
            retornoSimbolicoNatureza:
              retornoNat.value === ""
                ? null
                : (retornoNat.value as NonNullable<BasicSettings["retornoSimbolicoNatureza"]>),
          },
        };
      }}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="forma">Como as notas serão emitidas</Label>
          <select
            id="forma"
            name="forma"
            defaultValue={initial.formaFaturamento}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="EMISSOR_PROPRIO">Emissor próprio</option>
            <option value="EMISSOR_ML">Emissor do Mercado Livre</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="perfilVendedor">Perfil do vendedor (árvore CFOP)</Label>
          <select
            id="perfilVendedor"
            name="perfilVendedor"
            defaultValue={initial.perfilVendedor ?? "comercio"}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="comercio">Comércio (revenda)</option>
            <option value="industria">Indústria (produção própria)</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="logisticaPadrao">Logística padrão da venda</Label>
          <select
            id="logisticaPadrao"
            name="logisticaPadrao"
            defaultValue={initial.logisticaPadrao ?? "armazem_geral"}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="armazem_geral">Armazém geral / Full (5105–6106)</option>
            <option value="estoque_proprio">Estoque próprio (5101/5102/6107/6108/ST)</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="stInterestadualMode">ST interestadual (estoque próprio)</Label>
          <select
            id="stInterestadualMode"
            name="stInterestadualMode"
            defaultValue={initial.stInterestadualMode ?? "imposto_retido"}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="imposto_retido">Imposto já retido → 6404</option>
            <option value="protocolo">Protocolo / operação ST → 6403</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="retornoSimbolicoNatureza">CFOP retorno simbólico (natureza)</Label>
          <select
            id="retornoSimbolicoNatureza"
            name="retornoSimbolicoNatureza"
            defaultValue={initial.retornoSimbolicoNatureza ?? ""}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Automático (remessa 5905→1907; senão 1949/2949)</option>
            <option value="outras_entradas">Outras entradas → 1949 / 2949</option>
            <option value="retorno_venda_fora">Retorno venda fora → 1904 / 2904</option>
            <option value="retorno_deposito">Retorno depósito/armazém → 1907 / 2907</option>
          </select>
        </div>
      </div>
    </FiscalSettingsFormShell>
  );
}
