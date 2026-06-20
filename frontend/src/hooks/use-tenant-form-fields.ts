"use client";

import { useEffect, useState } from "react";
import { lookupCep, lookupCnpj } from "@/lib/lookup-actions";
import type { EmpresaFormValues } from "@/lib/empresa-form";
import type { TenantDto } from "@/lib/fiscal-types";

export const TENANT_CRT_OPTIONS = [
  { value: "1", label: "1 — Simples Nacional" },
  { value: "2", label: "2 — Simples (excesso sublimite)" },
  { value: "3", label: "3 — Regime Normal" },
] as const;

function toTenantFormState(tenant?: TenantDto, draft?: EmpresaFormValues): EmpresaFormValues {
  if (draft) return draft;
  return {
    razaoSocial: tenant?.razaoSocial ?? "",
    nomeFantasia: tenant?.nomeFantasia ?? "",
    cnpj: tenant?.cnpj ?? "",
    ie: tenant?.ie ?? "",
    iest: tenant?.iest ?? "",
    crt: String(tenant?.crt ?? 3),
    logradouro: tenant?.logradouro ?? "",
    numero: tenant?.numero ?? "SN",
    complemento: tenant?.complemento ?? "",
    bairro: tenant?.bairro ?? "",
    codigoMunicipio: tenant?.codigoMunicipio ?? "",
    municipio: tenant?.municipio ?? "",
    uf: tenant?.uf ?? "SP",
    cep: tenant?.cep ?? "",
    telefone: tenant?.telefone ?? "",
    ambiente: tenant?.ambiente ?? "HOMOLOGACAO",
  };
}

type UseTenantFormFieldsOptions = {
  tenant?: TenantDto;
  draft?: EmpresaFormValues;
  fieldErrors?: Record<string, string[]>;
};

/**
 * Estado e lookups CNPJ/CEP dos campos de empresa (emitente).
 */
export function useTenantFormFields({ tenant, draft, fieldErrors }: UseTenantFormFieldsOptions) {
  const [form, setForm] = useState<EmpresaFormValues>(() => toTenantFormState(tenant, draft));
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    if (draft) {
      setForm(draft);
      return;
    }
    if (tenant) setForm(toTenantFormState(tenant));
  }, [tenant?.id, draft]);

  const set = (key: keyof EmpresaFormValues, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const err = (name: keyof EmpresaFormValues) => fieldErrors?.[name]?.[0];

  async function onLookupCnpj() {
    setLookupError(null);
    setCnpjLoading(true);
    try {
      const data = await lookupCnpj(form.cnpj);
      let codigoMunicipio = data.codigoMunicipio || "";
      const cep = data.cep || form.cep;

      if (!codigoMunicipio && cep.replace(/\D/g, "").length === 8) {
        try {
          const cepLookup = await lookupCep(cep);
          codigoMunicipio = cepLookup.codigoMunicipio ?? "";
        } catch {
          // IBGE pode ser preenchido manualmente ou via Buscar CEP
        }
      }

      setForm((f) => ({
        ...f,
        razaoSocial: data.razaoSocial || f.razaoSocial,
        nomeFantasia: data.nomeFantasia || f.nomeFantasia,
        cnpj: data.cnpj,
        logradouro: data.logradouro || f.logradouro,
        numero: data.numero || f.numero,
        complemento: data.complemento ?? f.complemento,
        bairro: data.bairro || f.bairro,
        municipio: data.municipio || f.municipio,
        codigoMunicipio,
        uf: data.uf || f.uf,
        cep,
        telefone: data.telefone ?? f.telefone,
        crt: String(data.crt),
      }));
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : "Erro ao buscar CNPJ");
    } finally {
      setCnpjLoading(false);
    }
  }

  async function onLookupCep() {
    setLookupError(null);
    setCepLoading(true);
    try {
      const data = await lookupCep(form.cep);
      setForm((f) => ({
        ...f,
        cep: data.cep,
        logradouro: data.logradouro || f.logradouro,
        bairro: data.bairro || f.bairro,
        municipio: data.municipio || f.municipio,
        codigoMunicipio: data.codigoMunicipio ?? f.codigoMunicipio,
        uf: data.uf || f.uf,
      }));
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : "Erro ao buscar CEP");
    } finally {
      setCepLoading(false);
    }
  }

  return {
    form,
    set,
    lookupError,
    cnpjLoading,
    cepLoading,
    err,
    onLookupCnpj,
    onLookupCep,
  };
}
