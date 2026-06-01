import type { EnvironmentType, TenantInput } from "@/lib/fiscal-types";

export function parseEmpresaForm(formData: FormData): TenantInput {
  const opt = (key: string) => {
    const v = String(formData.get(key) ?? "").trim();
    return v.length > 0 ? v : undefined;
  };

  return {
    razaoSocial: String(formData.get("razaoSocial") ?? "").trim(),
    nomeFantasia: String(formData.get("nomeFantasia") ?? "").trim(),
    cnpj: String(formData.get("cnpj") ?? "").trim(),
    ie: String(formData.get("ie") ?? "").trim(),
    iest: opt("iest"),
    crt: Number(formData.get("crt") ?? 3),
    logradouro: String(formData.get("logradouro") ?? "").trim(),
    numero: String(formData.get("numero") ?? "SN").trim(),
    complemento: opt("complemento"),
    bairro: String(formData.get("bairro") ?? "").trim(),
    codigoMunicipio: String(formData.get("codigoMunicipio") ?? "").replace(/\D/g, ""),
    municipio: String(formData.get("municipio") ?? "").trim(),
    uf: String(formData.get("uf") ?? "").trim().toUpperCase(),
    cep: String(formData.get("cep") ?? "").replace(/\D/g, ""),
    codigoPais: 1058,
    nomePais: "Brasil",
    telefone: opt("telefone"),
    ambiente: String(formData.get("ambiente") ?? "HOMOLOGACAO") as EnvironmentType,
  };
}
