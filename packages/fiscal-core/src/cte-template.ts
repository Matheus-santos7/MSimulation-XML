/**
 * Constantes e cálculos compartilhados para CT-e de transporte ML (simulação).
 * Emitente do documento: Ebazar (transportador).
 */

export const CTE_ML_EMIT = {
  cnpj: "03007331010295",
  ie: "12500181",
  nome: "EBAZARCOMBR LTDA",
  logradouro: "Rua Francisco de Souza e Mello",
  numero: "1590",
  bairro: "Cordovil",
  codigoMunicipio: "3304557",
  municipio: "Rio de Janeiro",
  uf: "RJ",
  cep: "21010410",
} as const;

export const CTE_REMESSA_CFOP = "6353";
export const CTE_REMESSA_NAT_OP = "PRESTAÇÕES DE SERVIÇOS DE TRANSPORTE";
/** Venda full → consumidor (não contribuinte). */
export const CTE_VENDA_CFOP = "6357";
export const CTE_VENDA_NAT_OP = "PRESTAÇÃO DE SERVIÇO DE TRANSPORTE A NÃO CONTRIBUINTE";
export const CTE_RNTRC = "47923462";

export type CteTaxRuleIcms = {
  aliquotaIcmsInterna?: number | null;
  icms?: {
    pIcmsInternal?: number | null;
    pIcmsInterstate?: number | null;
  } | null;
};

export type CteVinculo = "remessa" | "venda";

/** CFOP e natureza conforme vínculo (remessa → CD / venda → consumidor). */
export function resolveCteDocumento(
  vinculo: CteVinculo,
  destIndIeDest: number,
): { cfop: string; natOp: string } {
  if (vinculo === "venda" && destIndIeDest === 9) {
    return { cfop: CTE_VENDA_CFOP, natOp: CTE_VENDA_NAT_OP };
  }
  return { cfop: CTE_REMESSA_CFOP, natOp: CTE_REMESSA_NAT_OP };
}

export type CteEndereco = {
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
};

export type CteParticipante = {
  doc: string;
  nome: string;
  ie?: string;
  indIEDest?: number;
  endereco: CteEndereco;
};

export type CteIcmsFrete = {
  cst: string;
  vBC: number;
  pICMS: number;
  vICMS: number;
};

export type CteRota = {
  cMunIni: string;
  xMunIni: string;
  ufIni: string;
  cMunFim: string;
  xMunFim: string;
  ufFim: string;
  origem: string;
  destino: string;
};

export type CteFiscalPayload = {
  nfeChaveRef: string;
  nfeTipo: string;
  remetente: CteParticipante;
  destinatario: CteParticipante;
  icms: CteIcmsFrete;
  rota: CteRota;
};

function round2(value: number): number {
  return Number((value + Number.EPSILON).toFixed(2));
}

/** Frete estimado (~0,686% do valor da carga, modelo ML). */
export function calcularValorFreteRemessa(valorCarga: number): number {
  return Math.max(12.9, Math.round(valorCarga * 0.00686 * 100) / 100);
}

/** Peso bruto estimado (kg) por unidade. */
export function calcularPesoCarga(quantidade: number): number {
  return Math.round(quantidade * 0.965 * 10000) / 10000;
}

/** Alíquota interestadual padrão para frete (mesma regra da NF-e B2B). */
export function aliquotaIcmsFreteInterestadual(ufOrigem: string, ufDestino: string): number {
  const o = ufOrigem.toUpperCase();
  const d = ufDestino.toUpperCase();
  if (o === d) return 0;
  const sulSudeste = new Set(["SP", "RJ", "MG", "PR", "SC", "RS"]);
  const norteNordesteCoEs = new Set([
    "AC", "AL", "AP", "AM", "BA", "CE", "ES", "GO", "MA", "MT", "MS",
    "PA", "PB", "PE", "PI", "RN", "RO", "RR", "SE", "TO", "DF",
  ]);
  if (sulSudeste.has(o) && norteNordesteCoEs.has(d)) return 7;
  return 12;
}

/**
 * Alíquota ICMS do frete: planilha tributária → NF-e → padrão legal.
 */
export function resolveAliqIcmsFrete(
  ufIni: string,
  ufFim: string,
  aliqIcmsNfe = 0,
  taxRule?: CteTaxRuleIcms | null,
): number {
  const intra = ufIni.toUpperCase() === ufFim.toUpperCase();
  if (intra) {
    const fromRule = taxRule?.aliquotaIcmsInterna ?? taxRule?.icms?.pIcmsInternal;
    if (fromRule != null && Number.isFinite(fromRule)) return fromRule;
    if (aliqIcmsNfe > 0) return aliqIcmsNfe;
    return 12;
  }
  const inter = taxRule?.icms?.pIcmsInterstate;
  if (inter != null && Number.isFinite(inter)) return inter;
  return aliquotaIcmsFreteInterestadual(ufIni, ufFim);
}

/** ICMS sobre o frete (vPrest). */
export function calcularIcmsFreteCte(
  vFrete: number,
  ufIni: string,
  ufFim: string,
  aliqIcmsNfe = 0,
  taxRule?: CteTaxRuleIcms | null,
): CteIcmsFrete {
  const pICMS = resolveAliqIcmsFrete(ufIni, ufFim, aliqIcmsNfe, taxRule);
  const vBC = round2(vFrete);
  const vICMS = round2(vBC * (pICMS / 100));
  return { cst: "00", vBC, pICMS, vICMS };
}

export type NfeDestinoInput = {
  destNome: string;
  destDoc: string;
  destUf: string;
  destIndIeDest: number;
  destLogradouro: string;
  destNumero: string;
  destComplemento?: string | null;
  destBairro: string;
  destCodigoMunicipio: string;
  destMunicipio: string;
  destCep: string;
  valor: { toString(): string } | number;
  quantidade: number;
  aliqIcms: { toString(): string } | number;
  chave: string;
  tipo: string;
  fiscalPayload?: unknown;
};

export type TenantRemetenteInput = {
  cnpj: string;
  ie: string;
  razaoSocial: string;
  logradouro: string;
  numero: string;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
};

function num(v: { toString(): string } | number): number {
  return typeof v === "number" ? v : Number(v);
}

function destIeFromNfe(nfe: NfeDestinoInput): string | undefined {
  const fp = (nfe.fiscalPayload as Record<string, unknown> | undefined) ?? {};
  const raw = typeof fp.destIe === "string" ? fp.destIe.replace(/\D/g, "") : "";
  return raw || undefined;
}

export function participanteDestinoFromNfe(nfe: NfeDestinoInput): CteParticipante {
  return {
    doc: nfe.destDoc.replace(/\D/g, ""),
    nome: nfe.destNome,
    ie: destIeFromNfe(nfe),
    indIEDest: nfe.destIndIeDest,
    endereco: {
      logradouro: nfe.destLogradouro,
      numero: nfe.destNumero,
      complemento: nfe.destComplemento ?? undefined,
      bairro: nfe.destBairro,
      codigoMunicipio: nfe.destCodigoMunicipio,
      municipio: nfe.destMunicipio,
      uf: nfe.destUf,
      cep: nfe.destCep.replace(/\D/g, ""),
    },
  };
}

export function participanteRemetenteFromTenant(tenant: TenantRemetenteInput): CteParticipante {
  return {
    doc: tenant.cnpj.replace(/\D/g, ""),
    nome: tenant.razaoSocial,
    ie: tenant.ie.replace(/\D/g, ""),
    endereco: {
      logradouro: tenant.logradouro,
      numero: tenant.numero,
      bairro: tenant.bairro,
      codigoMunicipio: tenant.codigoMunicipio,
      municipio: tenant.municipio,
      uf: tenant.uf,
      cep: tenant.cep.replace(/\D/g, ""),
    },
  };
}

/** Monta rota e tributos do CT-e a partir da NF-e vinculada (remessa ou venda). */
export function buildCteFiscalPayload(
  nfe: NfeDestinoInput,
  tenant: TenantRemetenteInput,
  opts?: { taxRule?: CteTaxRuleIcms | null },
): CteFiscalPayload {
  const remetente = participanteRemetenteFromTenant(tenant);
  const destinatario = participanteDestinoFromNfe(nfe);
  const ufIni = tenant.uf;
  const ufFim = nfe.destUf;
  const valorCarga = num(nfe.valor);
  const vFrete = calcularValorFreteRemessa(valorCarga);
  const icms = calcularIcmsFreteCte(vFrete, ufIni, ufFim, num(nfe.aliqIcms), opts?.taxRule);

  return {
    nfeChaveRef: nfe.chave,
    nfeTipo: nfe.tipo,
    remetente,
    destinatario,
    icms,
    rota: {
      cMunIni: tenant.codigoMunicipio,
      xMunIni: tenant.municipio,
      ufIni,
      cMunFim: nfe.destCodigoMunicipio,
      xMunFim: nfe.destMunicipio,
      ufFim,
      origem: `${tenant.municipio}/${ufIni}`,
      destino: `${nfe.destMunicipio}/${ufFim}`,
    },
  };
}
