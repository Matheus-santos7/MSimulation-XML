"use client";

import { useState } from "react";
import {
  FiscalInfoBanner,
  FiscalSettingsCard,
  FiscalSettingsScreenLayout,
} from "@/components/fiscal-settings/screen-layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BASE_CALC_ACTIONS } from "@/lib/fiscal-settings-constants";
import type {
  BaseCalcAction,
  ComposicaoLinha,
  ComposicaoTributo,
  FiscalEmitterSettingsData,
} from "@/lib/fiscal-emitter-settings-types";
import { cn } from "@/lib/utils";

type RowKey = keyof ComposicaoTributo;

const PIS_ROWS: { key: RowKey; label: string; info?: boolean }[] = [
  { key: "frete", label: "Frete" },
  { key: "desconto", label: "Desconto" },
  { key: "icms", label: "ICMS" },
  { key: "difal", label: "DIFAL" },
  { key: "fcpIcms", label: "FCP do ICMS" },
  { key: "fcpDifal", label: "FCP do Difal" },
  { key: "ipi", label: "IPI" },
  { key: "acrescimoPreco", label: "Acréscimo no preço do produto", info: true },
];

const ICMS_ROWS: { key: RowKey; label: string; info?: boolean }[] = [
  { key: "frete", label: "Frete" },
  { key: "desconto", label: "Desconto" },
  { key: "ipi", label: "IPI" },
  { key: "acrescimoPreco", label: "Acréscimo no preço do produto", info: true },
];

const IPI_ROWS: { key: RowKey; label: string; info?: boolean }[] = [
  { key: "frete", label: "Frete" },
  { key: "desconto", label: "Desconto" },
  { key: "acrescimoPreco", label: "Acréscimo no preço do produto", info: true },
];

function ActionSelect({
  value,
  onChange,
}: {
  value: BaseCalcAction;
  onChange: (v: BaseCalcAction) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as BaseCalcAction)}>
      <SelectTrigger className="h-9 border-0 bg-transparent shadow-none focus:ring-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {BASE_CALC_ACTIONS.map((a) => (
          <SelectItem key={a.value} value={a.value}>
            {a.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ComposicaoTable({
  title,
  rows,
  data,
  onChange,
}: {
  title: string;
  rows: { key: RowKey; label: string; info?: boolean }[];
  data: ComposicaoTributo;
  onChange: (next: ComposicaoTributo) => void;
}) {
  function patchRow(key: RowKey, field: keyof ComposicaoLinha, value: BaseCalcAction) {
    const line = data[key];
    if (!line) return;
    onChange({ ...data, [key]: { ...line, [field]: value } });
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>
      <FiscalSettingsCard>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Alíquota</th>
                <th className="px-4 py-2.5 font-medium">Sobre a venda</th>
                <th className="px-4 py-2.5 font-medium">Sobre a remessa</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ key, label, info }) => {
                const line = data[key];
                if (!line) return null;
                return (
                  <tr key={key} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 align-middle">
                      <span className="inline-flex items-center gap-1.5">
                        {label}
                        {info ? (
                          <span
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white"
                            title="Composição do acréscimo no preço do produto"
                          >
                            ?
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <ActionSelect value={line.venda} onChange={(v) => patchRow(key, "venda", v)} />
                    </td>
                    <td className="px-2 py-1">
                      <ActionSelect value={line.remessa} onChange={(v) => patchRow(key, "remessa", v)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </FiscalSettingsCard>
    </section>
  );
}

export function ComposicaoBaseEditor({
  initial,
}: {
  initial: FiscalEmitterSettingsData["taxes"]["composicaoBaseCalculo"];
}) {
  const [tab, setTab] = useState<"venda-remessa">("venda-remessa");
  const [pisCofins, setPisCofins] = useState(initial.pisCofins);
  const [icms, setIcms] = useState(initial.icms);
  const [ipi, setIpi] = useState(initial.ipi);

  return (
    <FiscalSettingsScreenLayout
      wide
      title="Configure a composição da base de cálculo"
      description="Para calcularmos os impostos em suas NF-e de venda e de remessa, selecione como quer aplicar as alíquotas."
      breadcrumb="Composição da base de cálculo"
      onSave={() => ({
        taxes: {
          composicaoBaseCalculo: {
            mode: "CUSTOM",
            pisCofins,
            icms,
            ipi,
          },
        },
      })}
    >
      <div className="border-b border-border">
        <button
          type="button"
          className={cn(
            "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            tab === "venda-remessa"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setTab("venda-remessa")}
        >
          Venda e remessa
        </button>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">IBS e CBS</h2>
        <FiscalInfoBanner>
          Em 2026, IBS e CBS ainda não entram no valor total da nota; a base de cálculo é definida pela Sefaz.
        </FiscalInfoBanner>
      </section>

      <ComposicaoTable title="PIS/COFINS" rows={PIS_ROWS} data={pisCofins} onChange={setPisCofins} />
      <ComposicaoTable title="ICMS" rows={ICMS_ROWS} data={icms} onChange={setIcms} />
      <ComposicaoTable title="IPI" rows={IPI_ROWS} data={ipi} onChange={setIpi} />
    </FiscalSettingsScreenLayout>
  );
}
