"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { salvarFaturadorMarketplaceAction } from "@/app/(app)/configuracoes-fiscais/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { MarketplaceBillingOverrides } from "@/lib/fiscal-api";
import type { FiscalEmitterSettingsData } from "@/lib/fiscal-emitter-settings-types";
import {
  BASIC_OVERRIDE_FIELDS,
  buildOverrides,
  INHERIT,
  optionLabel,
  parseCpfList,
  toFormValues,
  type MarketplaceBillingFormValues,
} from "@/lib/marketplace-billing-fields";
import type { MarketplaceCode } from "@/lib/marketplaces";

const SELECT_CLASS = "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

function OverrideStatus({ overridden }: { overridden: boolean }) {
  return (
    <span
      className={`text-[11px] font-bold uppercase tracking-wider ${
        overridden ? "text-accent" : "text-muted-foreground"
      }`}
    >
      {overridden ? "Sobrescrito" : "Herdado"}
    </span>
  );
}

/**
 * Campos que o marketplace pode sobrescrever. "Herdar" mostra o valor do padrão da empresa;
 * salvar substitui a sobrescrita inteira (o que a tela não edita é preservado).
 */
export function MarketplaceBillingForm({
  marketplace,
  overrides,
  defaults,
}: {
  marketplace: MarketplaceCode;
  overrides: MarketplaceBillingOverrides;
  /** Padrão da empresa, de onde vêm os valores herdados. */
  defaults: FiscalEmitterSettingsData;
}) {
  const router = useRouter();
  const [values, setValues] = useState<MarketplaceBillingFormValues>(() =>
    toFormValues(overrides),
  );
  const [cpfText, setCpfText] = useState((values.autXmlCpfs ?? []).join("\n"));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function setBasic(key: keyof MarketplaceBillingFormValues["basic"], value: string) {
    setValues((current) => ({ ...current, basic: { ...current.basic, [key]: value } }));
  }

  function save(next: MarketplaceBillingFormValues) {
    setError(null);
    setOk(false);
    startTransition(async () => {
      const res = await salvarFaturadorMarketplaceAction(
        marketplace,
        buildOverrides(overrides, next),
      );
      if (!res.ok) {
        setError(res.error ?? "Erro ao salvar");
        return;
      }
      setOk(true);
      router.refresh();
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    save({ ...values, autXmlCpfs: values.autXmlCpfs ? parseCpfList(cpfText) : null });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-[15px] font-semibold">Configurações básicas</h2>
        {BASIC_OVERRIDE_FIELDS.map((field) => {
          const current = values.basic[field.key];
          const inheritedLabel = optionLabel(field, defaults.basic[field.key]);

          return (
            <div key={field.key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                <OverrideStatus overridden={current !== INHERIT} />
              </div>
              <select
                id={field.key}
                value={current}
                onChange={(e) => setBasic(field.key, e.target.value)}
                className={SELECT_CLASS}
              >
                <option value={INHERIT}>Herdar do padrão ({inheritedLabel})</option>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold">CPFs autorizados no XML (autXML)</h2>
          <OverrideStatus overridden={values.autXmlCpfs !== null} />
        </div>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={values.autXmlCpfs !== null}
            onChange={(e) =>
              setValues((current) => ({
                ...current,
                autXmlCpfs: e.target.checked ? parseCpfList(cpfText) : null,
              }))
            }
          />
          Usar CPFs próprios para este marketplace
        </label>
        {values.autXmlCpfs === null ? (
          <p className="text-[13px] text-muted-foreground">
            Herdado:{" "}
            {defaults.nfe.autXmlCpfs?.length
              ? defaults.nfe.autXmlCpfs.join(", ")
              : "padrão do perfil do marketplace"}
          </p>
        ) : (
          <textarea
            value={cpfText}
            onChange={(e) => setCpfText(e.target.value)}
            rows={3}
            placeholder="Um CPF por linha"
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
          />
        )}
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {ok ? <p className="text-sm text-success">Configuração salva.</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            const reset = toFormValues({});
            setValues(reset);
            setCpfText("");
            save(reset);
          }}
        >
          Herdar tudo do padrão
        </Button>
      </div>
    </form>
  );
}
