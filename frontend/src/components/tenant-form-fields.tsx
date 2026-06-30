"use client";

import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EmpresaFormValues } from "@/lib/empresa-form";
import type { TenantDto } from "@/lib/fiscal-types";
import { BRAZILIAN_UFS } from "@/lib/brazilian-states";
import { cn } from "@/lib/utils";
import { TENANT_CRT_OPTIONS, useTenantFormFields, type TenantFormFieldsController } from "@/hooks/use-tenant-form-fields";

export type TenantFormSection = "identificacao" | "endereco" | "contato";

type TenantFormFieldsViewProps = {
  controller: TenantFormFieldsController;
  idPrefix?: string;
  layout?: "default" | "compact" | "onboarding";
  sections?: TenantFormSection[];
};

type TenantFormFieldsProps = Omit<TenantFormFieldsViewProps, "controller"> & {
  tenant?: TenantDto;
  draft?: EmpresaFormValues;
  fieldErrors?: Record<string, string[]>;
};

export function TenantFormFields({
  tenant,
  draft,
  fieldErrors,
  idPrefix = "tenant",
  layout = "default",
  sections,
}: TenantFormFieldsProps) {
  const controller = useTenantFormFields({ tenant, draft, fieldErrors });

  return (
    <TenantFormFieldsView
      controller={controller}
      idPrefix={idPrefix}
      layout={layout}
      sections={sections}
    />
  );
}

export function TenantFormFieldsView({
  controller,
  idPrefix = "tenant",
  layout = "default",
  sections,
}: TenantFormFieldsViewProps) {
  const { form, set, lookupError, cnpjLoading, cepLoading, err, onLookupCnpj, onLookupCep } = controller;

  const isCompact = layout === "compact";
  const isOnboarding = layout === "onboarding";
  const showSection = (section: TenantFormSection) => !sections || sections.includes(section);
  const showIdentificacao = showSection("identificacao");
  const showEndereco = showSection("endereco");
  const showContato = showSection("contato");
  const showMainGrid = showIdentificacao || showEndereco;

  return (
    <div className={cn("space-y-4 sm:space-y-6", isOnboarding && "space-y-3 sm:space-y-3")}>
      {lookupError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
          {lookupError}
        </div>
      )}

      {showMainGrid ? (
        <div className={cn("grid grid-cols-1 gap-4 sm:gap-6", !isCompact && !isOnboarding && showIdentificacao && showEndereco && "lg:grid-cols-2")}>
          {showIdentificacao ? (
        isOnboarding && !showEndereco ? (
          <IdentificacaoOnboardingFields
            idPrefix={idPrefix}
            form={form}
            set={set}
            err={err}
            cnpjLoading={cnpjLoading}
            onLookupCnpj={onLookupCnpj}
          />
        ) : (
        <Section title="Identificação (emit)" compact={isCompact} onboarding={isOnboarding}>
          <LookupRow
            id={`${idPrefix}-cnpj`}
            label="CNPJ"
            name="cnpj"
            value={form.cnpj}
            onChange={(value) => set("cnpj", value)}
            placeholder="00.000.000/0001-00"
            loading={cnpjLoading}
            onLookup={onLookupCnpj}
            lookupLabel="Buscar CNPJ"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id={`${idPrefix}-razaoSocial`} label="Razão social (xNome)" name="razaoSocial" value={form.razaoSocial} onChange={set} required error={err("razaoSocial")} />
            <Field id={`${idPrefix}-nomeFantasia`} label="Nome fantasia (xFant)" name="nomeFantasia" value={form.nomeFantasia} onChange={set} required error={err("nomeFantasia")} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id={`${idPrefix}-ie`} label="Inscrição estadual (IE)" name="ie" value={form.ie} onChange={set} required mono error={err("ie")} />
            <Field id={`${idPrefix}-iest`} label="IE substituto (IEST)" name="iest" value={form.iest} onChange={set} mono error={err("iest")} />
          </div>
          <div className={cn("grid grid-cols-1 gap-3", !isCompact && "sm:max-w-md")}>
            <SelectField id={`${idPrefix}-crt`} label="Regime tributário (CRT)" name="crt" value={form.crt} onChange={set} options={TENANT_CRT_OPTIONS} error={err("crt")} />
          </div>
        </Section>
        )
          ) : null}

          {showEndereco ? (
        isOnboarding && !showIdentificacao ? (
          <EnderecoOnboardingFields
            idPrefix={idPrefix}
            form={form}
            set={set}
            err={err}
            cepLoading={cepLoading}
            onLookupCep={onLookupCep}
          />
        ) : (
        <Section title="Endereço (enderEmit)" compact={isCompact} onboarding={isOnboarding}>
          <LookupRow
            id={`${idPrefix}-cep`}
            label="CEP"
            name="cep"
            value={form.cep}
            onChange={(value) => set("cep", value)}
            placeholder="00000-000"
            loading={cepLoading}
            onLookup={onLookupCep}
            lookupLabel="Buscar CEP"
          />
          <Field id={`${idPrefix}-logradouro`} label="Logradouro (xLgr)" name="logradouro" value={form.logradouro} onChange={set} required error={err("logradouro")} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id={`${idPrefix}-numero`} label="Número (nro)" name="numero" value={form.numero} onChange={set} required error={err("numero")} />
            <Field id={`${idPrefix}-complemento`} label="Complemento (xCpl)" name="complemento" value={form.complemento} onChange={set} error={err("complemento")} />
          </div>
          <Field id={`${idPrefix}-bairro`} label="Bairro (xBairro)" name="bairro" value={form.bairro} onChange={set} required error={err("bairro")} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id={`${idPrefix}-municipio`} label="Município (xMun)" name="municipio" value={form.municipio} onChange={set} required error={err("municipio")} />
            <Field
              id={`${idPrefix}-codigoMunicipio`}
              label="Cód. IBGE (cMun)"
              name="codigoMunicipio"
              value={form.codigoMunicipio}
              onChange={set}
              required
              mono
              error={err("codigoMunicipio")}
              hint="Se vazio após buscar CNPJ, clique em Buscar CEP"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:max-w-40">
            <SelectField id={`${idPrefix}-uf`} label="UF" name="uf" value={form.uf} onChange={set} options={BRAZILIAN_UFS} error={err("uf")} />
          </div>
        </Section>
        )
          ) : null}
        </div>
      ) : null}

      {showContato ? (
      isOnboarding && !showIdentificacao && !showEndereco ? (
        <ContatoOnboardingFields idPrefix={idPrefix} form={form} set={set} err={err} />
      ) : (
      <Section title="Contato e ambiente" compact={isCompact} onboarding={isOnboarding}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id={`${idPrefix}-telefone`} label="Telefone (fone)" name="telefone" value={form.telefone} onChange={set} mono error={err("telefone")} />
          <SelectField
            id={`${idPrefix}-ambiente`}
            label="Ambiente SEFAZ"
            name="ambiente"
            value={form.ambiente}
            onChange={set}
            error={err("ambiente")}
            options={[
              { value: "HOMOLOGACAO", label: "Homologação" },
              // { value: "PRODUCAO", label: "Produção" },
            ]}
          />
        </div>
      </Section>
      )
      ) : null}
    </div>
  );
}

/**
 * Layout compacto de identificação para o modal de onboarding (etapa 1).
 */
function IdentificacaoOnboardingFields({
  idPrefix,
  form,
  set,
  err,
  cnpjLoading,
  onLookupCnpj,
}: {
  idPrefix: string;
  form: EmpresaFormValues;
  set: TenantFormFieldsController["set"];
  err: (field: keyof EmpresaFormValues) => string | undefined;
  cnpjLoading: boolean;
  onLookupCnpj: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <LookupRow
          id={`${idPrefix}-cnpj`}
          label="CNPJ"
          name="cnpj"
          value={form.cnpj}
          onChange={(value) => set("cnpj", value)}
          placeholder="00.000.000/0001-00"
          loading={cnpjLoading}
          onLookup={onLookupCnpj}
          lookupLabel="Buscar"
          dense
        />
      </div>
      <Field id={`${idPrefix}-razaoSocial`} label="Razão social (xNome)" name="razaoSocial" value={form.razaoSocial} onChange={set} required error={err("razaoSocial")} dense />
      <Field id={`${idPrefix}-nomeFantasia`} label="Nome fantasia (xFant)" name="nomeFantasia" value={form.nomeFantasia} onChange={set} required error={err("nomeFantasia")} dense />
      <Field id={`${idPrefix}-ie`} label="Inscrição estadual (IE)" name="ie" value={form.ie} onChange={set} required mono error={err("ie")} dense />
      <Field id={`${idPrefix}-iest`} label="IE substituto (IEST)" name="iest" value={form.iest} onChange={set} mono error={err("iest")} dense />
      <div className="sm:col-span-2 sm:max-w-md">
        <SelectField id={`${idPrefix}-crt`} label="Regime tributário (CRT)" name="crt" value={form.crt} onChange={set} options={TENANT_CRT_OPTIONS} error={err("crt")} dense />
      </div>
    </div>
  );
}

/**
 * Layout de endereço otimizado para o modal de onboarding (etapa 2).
 */
function EnderecoOnboardingFields({
  idPrefix,
  form,
  set,
  err,
  cepLoading,
  onLookupCep,
}: {
  idPrefix: string;
  form: EmpresaFormValues;
  set: TenantFormFieldsController["set"];
  err: (field: keyof EmpresaFormValues) => string | undefined;
  cepLoading: boolean;
  onLookupCep: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <LookupRow
          id={`${idPrefix}-cep`}
          label="CEP"
          name="cep"
          value={form.cep}
          onChange={(value) => set("cep", value)}
          placeholder="00000-000"
          loading={cepLoading}
          onLookup={onLookupCep}
          lookupLabel="Buscar"
          dense
        />
      </div>
      <div className="sm:col-span-2">
        <Field id={`${idPrefix}-logradouro`} label="Logradouro (xLgr)" name="logradouro" value={form.logradouro} onChange={set} required error={err("logradouro")} dense />
      </div>
      <Field id={`${idPrefix}-numero`} label="Número (nro)" name="numero" value={form.numero} onChange={set} required error={err("numero")} dense />
      <Field id={`${idPrefix}-complemento`} label="Complemento (xCpl)" name="complemento" value={form.complemento} onChange={set} error={err("complemento")} dense />
      <div className="sm:col-span-2">
        <Field id={`${idPrefix}-bairro`} label="Bairro (xBairro)" name="bairro" value={form.bairro} onChange={set} required error={err("bairro")} dense />
      </div>
      <div className="sm:col-span-2">
        <Field id={`${idPrefix}-municipio`} label="Município (xMun)" name="municipio" value={form.municipio} onChange={set} required error={err("municipio")} dense />
      </div>
      <SelectField id={`${idPrefix}-uf`} label="UF" name="uf" value={form.uf} onChange={set} options={BRAZILIAN_UFS} error={err("uf")} dense />
      <Field
        id={`${idPrefix}-codigoMunicipio`}
        label="Cód. IBGE (cMun)"
        name="codigoMunicipio"
        value={form.codigoMunicipio}
        onChange={set}
        required
        mono
        error={err("codigoMunicipio")}
        dense
      />
    </div>
  );
}

function ContatoOnboardingFields({
  idPrefix,
  form,
  set,
  err,
}: {
  idPrefix: string;
  form: EmpresaFormValues;
  set: TenantFormFieldsController["set"];
  err: (field: keyof EmpresaFormValues) => string | undefined;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Field id={`${idPrefix}-telefone`} label="Telefone (fone)" name="telefone" value={form.telefone} onChange={set} mono error={err("telefone")} dense />
      <SelectField
        id={`${idPrefix}-ambiente`}
        label="Ambiente SEFAZ"
        name="ambiente"
        value={form.ambiente}
        onChange={set}
        error={err("ambiente")}
        dense
        options={[
          { value: "HOMOLOGACAO", label: "Homologação" },
        ]}
      />
    </div>
  );
}

function LookupRow({
  id,
  label,
  name,
  value,
  onChange,
  placeholder,
  loading,
  onLookup,
  lookupLabel,
  dense = false,
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  loading: boolean;
  onLookup: () => void;
  lookupLabel: string;
  dense?: boolean;
}) {
  return (
    <div className={cn("flex gap-2", dense ? "flex-row items-end" : "flex-col sm:flex-row sm:items-end")}>
      <div className={cn("min-w-0 flex-1", dense ? "space-y-1" : "space-y-2")}>
        <Label htmlFor={id} className={dense ? "text-[12px]" : undefined}>{label}</Label>
        <Input
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          placeholder={placeholder}
          className={cn("font-mono", dense && "h-8 text-[13px]")}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onLookup}
        disabled={loading}
        className={cn("shrink-0", dense ? "h-8 px-3" : "w-full sm:w-auto")}
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
        <span className="ml-1.5">{lookupLabel}</span>
      </Button>
    </div>
  );
}

function Section({
  title,
  children,
  compact = false,
  onboarding = false,
}: {
  title: string;
  children: React.ReactNode;
  compact?: boolean;
  onboarding?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 space-y-3 sm:space-y-4",
        compact
          ? "space-y-3"
          : onboarding
            ? "rounded-lg border border-border/50 bg-background p-4 sm:p-5"
            : "rounded-lg border border-border/60 bg-muted/20 p-3 sm:p-4 lg:p-5",
      )}
    >
      <h3
        className={cn(
          "font-bold uppercase tracking-widest text-muted-foreground",
          compact || onboarding
            ? "border-b border-border/60 pb-2 text-[11px]"
            : "border-b border-border pb-2 text-[11px] sm:text-[12px]",
        )}
      >
        {title}
      </h3>
      <div className="space-y-3 sm:space-y-4">{children}</div>
    </div>
  );
}

function Field({
  id,
  label,
  name,
  value,
  onChange,
  required,
  placeholder,
  mono,
  error,
  hint,
  dense = false,
}: {
  id: string;
  label: string;
  name: keyof EmpresaFormValues;
  value: string;
  onChange: (key: keyof EmpresaFormValues, value: string) => void;
  required?: boolean;
  placeholder?: string;
  mono?: boolean;
  error?: string;
  hint?: string;
  dense?: boolean;
}) {
  return (
    <div className={cn("min-w-0", dense ? "space-y-1" : "space-y-2")}>
      <Label htmlFor={id} className={dense ? "text-[12px]" : undefined}>{label}</Label>
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        required={required}
        placeholder={placeholder}
        className={cn(mono && "font-mono", dense && "h-8 text-[13px]")}
        aria-invalid={!!error}
      />
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

function SelectField({
  id,
  label,
  name,
  value,
  onChange,
  options,
  error,
  dense = false,
}: {
  id: string;
  label: string;
  name: keyof EmpresaFormValues;
  value: string;
  onChange: (key: keyof EmpresaFormValues, value: string) => void;
  options: readonly string[] | readonly { value: string; label: string }[];
  error?: string;
  dense?: boolean;
}) {
  return (
    <div className={cn("min-w-0", dense ? "space-y-1" : "space-y-2")}>
      <Label htmlFor={id} className={dense ? "text-[12px]" : undefined}>{label}</Label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        required
        aria-invalid={!!error}
        className={cn(
          "flex w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          dense ? "h-8 text-[13px]" : "h-9",
        )}
      >
        {options.map((opt) =>
          typeof opt === "string" ? (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ) : (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ),
        )}
      </select>
      {error && <p className={cn("text-destructive", dense ? "text-[11px]" : "text-[12px]")}>{error}</p>}
    </div>
  );
}
