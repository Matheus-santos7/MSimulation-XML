export type {
  BaseCalcAction,
  ComposicaoLinha,
  ComposicaoTributo,
  CstDevolucaoMap,
  DifalCalculo,
  FiscalEmitterSettingsData,
  SettingsMode,
} from "@msimulation-xml/fiscal-core";
import type {
  BaseCalcAction,
  ComposicaoLinha,
  ComposicaoTributo,
  CstDevolucaoMap,
  DefaultIcmsRates,
  DefaultPisCofinsRates,
  DifalCalculo,
  FiscalEmitterSettingsData,
} from "@msimulation-xml/fiscal-core";
import { DEFAULT_NFE_NUMERACAO } from "@msimulation-xml/fiscal-core";

const BR_UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

const linha = (
  venda: BaseCalcAction,
  remessa: BaseCalcAction,
): ComposicaoLinha => ({ venda, remessa });

const composicaoPisCofins = (): ComposicaoTributo => ({
  frete: linha("INCLUIR_NA_BASE", "INCLUIR_NA_BASE"),
  desconto: linha("SUBTRAIR_DA_BASE", "SUBTRAIR_DA_BASE"),
  icms: linha("SUBTRAIR_DA_BASE", "SUBTRAIR_DA_BASE"),
  difal: linha("SUBTRAIR_DA_BASE", "SUBTRAIR_DA_BASE"),
  fcpIcms: linha("NAO_SUBTRAIR", "NAO_SUBTRAIR"),
  fcpDifal: linha("NAO_SUBTRAIR", "NAO_SUBTRAIR"),
  ipi: linha("NAO_INCLUIR", "NAO_INCLUIR"),
  acrescimoPreco: linha("NAO_INCLUIR", "NAO_INCLUIR"),
});

const composicaoIcms = (): ComposicaoTributo => ({
  frete: linha("INCLUIR_NA_BASE", "INCLUIR_NA_BASE"),
  desconto: linha("SUBTRAIR_DA_BASE", "SUBTRAIR_DA_BASE"),
  ipi: linha("INCLUIR_NA_BASE", "INCLUIR_NA_BASE"),
  acrescimoPreco: linha("NAO_INCLUIR", "NAO_INCLUIR"),
});

const composicaoIpi = (): ComposicaoTributo => ({
  frete: linha("INCLUIR_NA_BASE", "INCLUIR_NA_BASE"),
  desconto: linha("SUBTRAIR_DA_BASE", "SUBTRAIR_DA_BASE"),
  acrescimoPreco: linha("NAO_INCLUIR", "NAO_INCLUIR"),
});

export const DEFAULT_CST_DEVOLUCAO_ICMS: CstDevolucaoMap[] = [
  { venda: "102", devolucao: "41" },
  { venda: "103", devolucao: "41" },
  { venda: "300", devolucao: "41" },
  { venda: "400", devolucao: "41" },
  { venda: "500", devolucao: "60" },
];

export const DEFAULT_CST_DEVOLUCAO_PIS_COFINS: CstDevolucaoMap[] = [
  { venda: "01", devolucao: "50" },
  { venda: "02", devolucao: "50" },
  { venda: "03", devolucao: "50" },
  { venda: "04", devolucao: "50" },
  { venda: "05", devolucao: "50" },
  { venda: "06", devolucao: "50" },
  { venda: "07", devolucao: "50" },
  { venda: "08", devolucao: "50" },
  { venda: "09", devolucao: "50" },
  { venda: "49", devolucao: "98" },
  { venda: "99", devolucao: "98" },
];

export const DEFAULT_ICMS_FALLBACK_RATES = {
  intra: 18,
  interSale: 12,
  interInbound: 4,
} as const;

export const DEFAULT_PIS_COFINS_RATES = {
  pis: 1.65,
  cofins: 7.6,
} as const;

function defaultDifalPorUf(): Record<string, DifalCalculo> {
  return Object.fromEntries(BR_UFS.map((uf) => [uf, uf === "PB" ? "BASE_DUPLA_COM_ICMS" : "PADRAO"]));
}

export const DEFAULT_FISCAL_EMITTER_SETTINGS: FiscalEmitterSettingsData = {
  basic: {
    formaFaturamento: "EMISSOR_PROPRIO",
    dadosFiscaisAnunciosOk: false,
    dadosFiscaisAnunciosNota: "",
  },
  taxes: {
    cstDevolucao: {
      mode: "CUSTOM",
      icms: DEFAULT_CST_DEVOLUCAO_ICMS,
      pisCofins: DEFAULT_CST_DEVOLUCAO_PIS_COFINS,
    },
    composicaoBaseCalculo: {
      mode: "CUSTOM",
      pisCofins: composicaoPisCofins(),
      icms: composicaoIcms(),
      ipi: composicaoIpi(),
    },
    calculoDifal: {
      mode: "CUSTOM",
      bulk: "PADRAO",
      porUf: defaultDifalPorUf(),
    },
    modalidadeFrete: {
      mode: "CUSTOM",
      fullfilmentVendas: "0",
      fullfilmentEntrada: "9",
      coleta: "2",
      flex: "0",
      turbo: "0",
    },
    emissaoGnre: {
      mode: "DEFAULT",
      estadosIeCount: 0,
      estadosComIe: [],
    },
    defaultIcmsRates: { ...DEFAULT_ICMS_FALLBACK_RATES },
    defaultPisCofins: { ...DEFAULT_PIS_COFINS_RATES },
  },
  nfe: {
    mensagemNfeOk: false,
    mensagemPadrao: "",
    acrescimoPrecoProduto: false,
    freteNoCalculo: true,
    prazoCancelamento: { horas: 24, naoInformar: false },
    acessoExternoContatos: 0,
    contatos: [],
    numeracao: structuredClone(DEFAULT_NFE_NUMERACAO),
  },
};

function mergeDefaultIcmsRates(
  base: DefaultIcmsRates | undefined,
  patch?: Partial<DefaultIcmsRates>,
): DefaultIcmsRates {
  const resolved = base ?? { ...DEFAULT_ICMS_FALLBACK_RATES };
  return {
    intra: patch?.intra ?? resolved.intra,
    interSale: patch?.interSale ?? resolved.interSale,
    interInbound: patch?.interInbound ?? resolved.interInbound,
  };
}

function mergeDefaultPisCofinsRates(
  base: DefaultPisCofinsRates | undefined,
  patch?: Partial<DefaultPisCofinsRates>,
): DefaultPisCofinsRates {
  const resolved = base ?? { ...DEFAULT_PIS_COFINS_RATES };
  return {
    pis: patch?.pis ?? resolved.pis,
    cofins: patch?.cofins ?? resolved.cofins,
  };
}

function mergeComposicaoTributo(
  base: ComposicaoTributo,
  patch?: Partial<ComposicaoTributo>,
): ComposicaoTributo {
  if (!patch) return base;
  const keys = Object.keys(patch) as (keyof ComposicaoTributo)[];
  const out = { ...base };
  for (const k of keys) {
    const p = patch[k];
    if (p) out[k] = { ...base[k], ...p };
  }
  return out;
}

export function mergeFiscalEmitterSettings(partial: unknown): FiscalEmitterSettingsData {
  const base = structuredClone(DEFAULT_FISCAL_EMITTER_SETTINGS);
  if (!partial || typeof partial !== "object") return base;
  const p = partial as Partial<FiscalEmitterSettingsData>;

  return {
    basic: { ...base.basic, ...p.basic },
    taxes: {
      ...base.taxes,
      ...p.taxes,
      cstDevolucao: {
        ...base.taxes.cstDevolucao,
        ...p.taxes?.cstDevolucao,
        icms: p.taxes?.cstDevolucao?.icms ?? base.taxes.cstDevolucao.icms,
        pisCofins: p.taxes?.cstDevolucao?.pisCofins ?? base.taxes.cstDevolucao.pisCofins,
      },
      composicaoBaseCalculo: {
        ...base.taxes.composicaoBaseCalculo,
        ...p.taxes?.composicaoBaseCalculo,
        pisCofins: mergeComposicaoTributo(
          base.taxes.composicaoBaseCalculo.pisCofins,
          p.taxes?.composicaoBaseCalculo?.pisCofins,
        ),
        icms: mergeComposicaoTributo(
          base.taxes.composicaoBaseCalculo.icms,
          p.taxes?.composicaoBaseCalculo?.icms,
        ),
        ipi: mergeComposicaoTributo(
          base.taxes.composicaoBaseCalculo.ipi,
          p.taxes?.composicaoBaseCalculo?.ipi,
        ),
      },
      calculoDifal: {
        ...base.taxes.calculoDifal,
        ...p.taxes?.calculoDifal,
        porUf: { ...base.taxes.calculoDifal.porUf, ...p.taxes?.calculoDifal?.porUf },
      },
      modalidadeFrete: { ...base.taxes.modalidadeFrete, ...p.taxes?.modalidadeFrete },
      emissaoGnre: {
        ...base.taxes.emissaoGnre,
        ...p.taxes?.emissaoGnre,
        estadosComIe: p.taxes?.emissaoGnre?.estadosComIe ?? base.taxes.emissaoGnre.estadosComIe,
      },
      defaultIcmsRates: mergeDefaultIcmsRates(
        base.taxes.defaultIcmsRates,
        p.taxes?.defaultIcmsRates,
      ),
      defaultPisCofins: mergeDefaultPisCofinsRates(
        base.taxes.defaultPisCofins,
        p.taxes?.defaultPisCofins,
      ),
    },
    nfe: {
      ...base.nfe,
      ...p.nfe,
      prazoCancelamento: {
        ...base.nfe.prazoCancelamento,
        ...p.nfe?.prazoCancelamento,
      },
      contatos: p.nfe?.contatos ?? base.nfe.contatos,
      autXmlCpfs: p.nfe?.autXmlCpfs ?? base.nfe.autXmlCpfs,
      numeracao: {
        remessa: {
          ...base.nfe.numeracao!.remessa,
          ...p.nfe?.numeracao?.remessa,
        },
        transferencia: {
          ...base.nfe.numeracao!.transferencia,
          ...p.nfe?.numeracao?.transferencia,
        },
      },
    },
  };
}
