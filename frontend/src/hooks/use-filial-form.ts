"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createFilialAction, updateFilialAction } from "@/app/(app)/empresas/actions";
import { lookupCep, lookupCnpj } from "@/lib/lookup-actions";
import type { TenantFilialDto, TenantFilialInput } from "@/lib/fiscal-types";

export type FilialFormState = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  ie: string;
  crt: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  serieRemessa: string;
  unidadeLogisticaPadraoId: string;
};

export function toFilialFormState(filial?: TenantFilialDto): FilialFormState {
  return {
    razaoSocial: filial?.razaoSocial ?? "",
    nomeFantasia: filial?.nomeFantasia ?? "",
    cnpj: filial?.cnpj ?? "",
    ie: filial?.ie ?? "",
    crt: String(filial?.crt ?? 3),
    logradouro: filial?.logradouro ?? "",
    numero: filial?.numero ?? "SN",
    complemento: filial?.complemento ?? "",
    bairro: filial?.bairro ?? "",
    codigoMunicipio: filial?.codigoMunicipio ?? "",
    municipio: filial?.municipio ?? "",
    uf: filial?.uf ?? "",
    cep: filial?.cep ?? "",
    telefone: filial?.telefone ?? "",
    serieRemessa: String(filial?.serieRemessa ?? 8),
    unidadeLogisticaPadraoId: filial?.unidadeLogisticaPadraoId ?? "",
  };
}

export function filialFormStateToPayload(form: FilialFormState): TenantFilialInput {
  return {
    razaoSocial: form.razaoSocial,
    nomeFantasia: form.nomeFantasia,
    cnpj: form.cnpj,
    ie: form.ie,
    crt: Number(form.crt),
    logradouro: form.logradouro,
    numero: form.numero,
    complemento: form.complemento || undefined,
    bairro: form.bairro,
    codigoMunicipio: form.codigoMunicipio,
    municipio: form.municipio,
    uf: form.uf.toUpperCase(),
    cep: form.cep,
    telefone: form.telefone || undefined,
    serieRemessa: Number(form.serieRemessa),
    unidadeLogisticaPadraoId: form.unidadeLogisticaPadraoId || undefined,
  };
}

type UseFilialFormOptions = {
  filial?: TenantFilialDto;
  onSaved?: () => void;
};

/**
 * Estado, lookups CNPJ/CEP e submit do formulário de filial.
 */
export function useFilialForm({ filial, onSaved }: UseFilialFormOptions) {
  const router = useRouter();
  const isEdit = Boolean(filial);
  const [form, setForm] = useState<FilialFormState>(() => toFilialFormState(filial));
  const [error, setError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    setForm(toFilialFormState(filial));
  }, [filial?.id]);

  const set = (key: keyof FilialFormState, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const fieldId = (name: string) => (filial ? `${filial.id}-${name}` : name);

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
          // IBGE pode ser preenchido via Buscar CEP
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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const payload = filialFormStateToPayload(form);
    try {
      const result = filial
        ? await updateFilialAction(filial.id, payload)
        : await createFilialAction(payload);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (!filial) {
        setForm(toFilialFormState());
      }
      router.refresh();
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : isEdit ? "Erro ao atualizar filial" : "Erro ao cadastrar filial");
    } finally {
      setPending(false);
    }
  }

  return {
    form,
    set,
    error,
    lookupError,
    pending,
    cnpjLoading,
    cepLoading,
    isEdit,
    fieldId,
    onLookupCnpj,
    onLookupCep,
    onSubmit,
  };
}
