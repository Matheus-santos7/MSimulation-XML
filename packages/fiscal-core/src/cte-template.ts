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

/** Prestação de transporte interestadual (remessa / contribuinte). */
export const CTE_REMESSA_CFOP = "6353";
/** Prestação de transporte intraestadual (remessa / contribuinte). */
export const CTE_REMESSA_CFOP_INTRA = "5353";
export const CTE_REMESSA_NAT_OP = "PRESTAÇÕES DE SERVIÇOS DE TRANSPORTE";
/** Venda full → consumidor não contribuinte, interestadual. */
export const CTE_VENDA_CFOP = "6357";
/** Venda full → consumidor não contribuinte, intraestadual. */
export const CTE_VENDA_CFOP_INTRA = "5357";
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

/**
 * Indica se o serviço de transporte é intraestadual (mesma UF início/fim).
 */
export function isCteIntraestadual(ufIni: string, ufFim: string): boolean {
  return ufIni.trim().toUpperCase() === ufFim.trim().toUpperCase();
}

/**
 * CFOP e natureza conforme vínculo e territorialidade do serviço.
 * Remessa / contribuinte: 5353 (intra) ou 6353 (inter).
 * Venda a não contribuinte (`indIEDest=9`): 5357 (intra) ou 6357 (inter).
 */
export function resolveCteDocumento(
  vinculo: CteVinculo,
  destIndIeDest: number,
  ufIni: string,
  ufFim: string,
): { cfop: string; natOp: string } {
  const intra = isCteIntraestadual(ufIni, ufFim);
  if (vinculo === "venda" && destIndIeDest === 9) {
    return {
      cfop: intra ? CTE_VENDA_CFOP_INTRA : CTE_VENDA_CFOP,
      natOp: CTE_VENDA_NAT_OP,
    };
  }
  return {
    cfop: intra ? CTE_REMESSA_CFOP_INTRA : CTE_REMESSA_CFOP,
    natOp: CTE_REMESSA_NAT_OP,
  };
}

import type { CteEmitente } from "./cte-emitente.js";

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

/** Alíquotas cumulativas PIS/COFINS sobre prestação de transporte (CT-e ML). */
export const CTE_FRETE_PIS_ALIQ = 1.65;
export const CTE_FRETE_COFINS_ALIQ = 7.6;

export const CTE_IBS_CBS_DEFAULT = {
  cst: "000",
  cClassTrib: "000001",
  pIBSUF: 0.1,
  pIBSMun: 0,
  pCBS: 0.9,
} as const;

export type CteIbsCbsFrete = {
  cst: string;
  cClassTrib: string;
  vBC: number;
  pIBSUF: number;
  vIBSUF: number;
  pIBSMun: number;
  vIBSMun: number;
  vIBS: number;
  pCBS: number;
  vCBS: number;
  vPIS: number;
  vCOFINS: number;
  vTotDFe: number;
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
  /** Filial Ebazar no CD; preenchido na emissão. */
  emitente?: CteEmitente;
  remetente: CteParticipante;
  destinatario: CteParticipante;
  icms: CteIcmsFrete;
  ibsCbs: CteIbsCbsFrete;
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

/** PIS/COFINS cumulativos sobre o frete líquido de ICMS (base UB16-10 para CT-e). */
export function calcularPisCofinsFreteCte(vFrete: number, vICMS: number) {
  const vBC = round2(Math.max(0, vFrete - vICMS));
  const vPIS = round2(vBC * (CTE_FRETE_PIS_ALIQ / 100));
  const vCOFINS = round2(vBC * (CTE_FRETE_COFINS_ALIQ / 100));
  return { vBC, vPIS, vCOFINS };
}

/**
 * IBS/CBS do frete: base = vPrest − ICMS − PIS − COFINS (reforma tributária / NT 2025.002).
 */
export function calcularIbsCbsFreteCte(
  vFrete: number,
  icms: CteIcmsFrete,
  rates: Partial<typeof CTE_IBS_CBS_DEFAULT> = {},
): CteIbsCbsFrete {
  const { vPIS, vCOFINS } = calcularPisCofinsFreteCte(vFrete, icms.vICMS);
  const vBC = round2(Math.max(0, vFrete - icms.vICMS - vPIS - vCOFINS));
  const pIBSUF = rates.pIBSUF ?? CTE_IBS_CBS_DEFAULT.pIBSUF;
  const pIBSMun = rates.pIBSMun ?? CTE_IBS_CBS_DEFAULT.pIBSMun;
  const pCBS = rates.pCBS ?? CTE_IBS_CBS_DEFAULT.pCBS;
  const vIBSUF = round2(vBC * (pIBSUF / 100));
  const vIBSMun = round2(vBC * (pIBSMun / 100));
  const vIBS = round2(vIBSUF + vIBSMun);
  const vCBS = round2(vBC * (pCBS / 100));

  return {
    cst: rates.cst ?? CTE_IBS_CBS_DEFAULT.cst,
    cClassTrib: rates.cClassTrib ?? CTE_IBS_CBS_DEFAULT.cClassTrib,
    vBC,
    pIBSUF,
    vIBSUF,
    pIBSMun,
    vIBSMun,
    vIBS,
    pCBS,
    vCBS,
    vPIS,
    vCOFINS,
    vTotDFe: round2(vFrete),
  };
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

/** Monta rota do CT-e conforme vínculo e local do emitente (CD ML). */
export function buildCteRota(
  nfe: NfeDestinoInput,
  tenant: TenantRemetenteInput,
  opts?: { emitente?: CteEmitente; vinculo?: CteVinculo },
): CteRota {
  const ufFim = nfe.destUf.trim().toUpperCase();
  const cMunFim = nfe.destCodigoMunicipio;
  const xMunFim = nfe.destMunicipio;

  if (opts?.vinculo === "venda" && opts.emitente) {
    const emitente = opts.emitente;
    return {
      cMunIni: emitente.codigoMunicipio,
      xMunIni: emitente.municipio,
      ufIni: emitente.uf,
      cMunFim,
      xMunFim,
      ufFim,
      origem: `${emitente.municipio}/${emitente.uf}`,
      destino: `${xMunFim}/${ufFim}`,
    };
  }

  const ufIni = tenant.uf.trim().toUpperCase();
  return {
    cMunIni: tenant.codigoMunicipio,
    xMunIni: tenant.municipio,
    ufIni,
    cMunFim,
    xMunFim,
    ufFim,
    origem: `${tenant.municipio}/${ufIni}`,
    destino: `${xMunFim}/${ufFim}`,
  };
}

/** UF de origem do serviço de transporte para cálculo de ICMS do frete. */
export function resolveCteIcmsUfIni(
  tenant: TenantRemetenteInput,
  opts?: { emitente?: CteEmitente; vinculo?: CteVinculo },
): string {
  if (opts?.vinculo === "venda" && opts.emitente) {
    return opts.emitente.uf;
  }
  return tenant.uf;
}

/** Monta rota e tributos do CT-e a partir da NF-e vinculada (remessa ou venda). */
export function buildCteFiscalPayload(
  nfe: NfeDestinoInput,
  tenant: TenantRemetenteInput,
  opts?: {
    taxRule?: CteTaxRuleIcms | null;
    vFrete?: number;
    emitente?: CteEmitente;
    vinculo?: CteVinculo;
  },
): CteFiscalPayload {
  const remetente = participanteRemetenteFromTenant(tenant);
  const destinatario = participanteDestinoFromNfe(nfe);
  const rota = buildCteRota(nfe, tenant, opts);
  const ufFim = nfe.destUf;
  const valorCarga = num(nfe.valor);
  const vFrete =
    typeof opts?.vFrete === "number" && opts.vFrete > 0
      ? round2(opts.vFrete)
      : calcularValorFreteRemessa(valorCarga);
  const ufIcmsIni = resolveCteIcmsUfIni(tenant, opts);
  const icms = calcularIcmsFreteCte(vFrete, ufIcmsIni, ufFim, num(nfe.aliqIcms), opts?.taxRule);
  const ibsCbs = calcularIbsCbsFreteCte(vFrete, icms);

  return {
    nfeChaveRef: nfe.chave,
    nfeTipo: nfe.tipo,
    remetente,
    destinatario,
    icms,
    ibsCbs,
    rota,
  };
}
